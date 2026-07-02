import os
import shutil
import subprocess
from dotenv import load_dotenv
from google import genai
from google.genai import types

# Load .env from parent directory (minicursor root)
load_dotenv(os.path.join(os.path.dirname(__file__), '..', '.env'))

client = genai.Client()

SYSTEM_INSTRUCTION = """You are Mini-Cursor, an advanced autonomous software engineering agent.
You have direct access to the user's local filesystem and terminal.

Your workflow:
1. When a user asks you to create, modify, inspect, or run code, select the appropriate tool.
2. If a task requires multiple steps (e.g., write a script, then test it by running it), execute the tools sequentially.
3. Always explain your intent briefly to the user before running a tool.
4. If an execution fails, inspect the error output and correct your steps.
"""

# ── Explicit tool schemas (more reliable than auto-inference for lite models) ──
TOOL_DECLARATIONS = types.Tool(function_declarations=[
    types.FunctionDeclaration(
        name="write_file",
        description="Creates or overwrites a file at the specified path with the given content string.",
        parameters=types.Schema(
            type=types.Type.OBJECT,
            properties={
                "filepath": types.Schema(type=types.Type.STRING, description="Absolute or relative path of the file to write or create."),
                "content":  types.Schema(type=types.Type.STRING, description="Full text content to write into the file."),
            },
            required=["filepath", "content"],
        ),
    ),
    types.FunctionDeclaration(
        name="read_file",
        description="Reads and returns the complete contents of a file at the specified path.",
        parameters=types.Schema(
            type=types.Type.OBJECT,
            properties={
                "filepath": types.Schema(type=types.Type.STRING, description="Absolute or relative path of the file to read."),
            },
            required=["filepath"],
        ),
    ),
    types.FunctionDeclaration(
        name="execute_command",
        description="Executes a PowerShell or terminal command on the host Windows system and returns stdout/stderr.",
        parameters=types.Schema(
            type=types.Type.OBJECT,
            properties={
                "command": types.Schema(type=types.Type.STRING, description="The shell command to execute."),
            },
            required=["command"],
        ),
    ),
])


# ── Tool implementations ───────────────────────────────────────────────────────

def _execute_command(command: str) -> str:
    command = command.strip()
    print(f"  [TOOL] execute_command: {command[:100]}")
    try:
        ps_path = shutil.which("powershell")
        exec_args = [ps_path, "-Command", command] if ps_path else command
        result = subprocess.run(
            exec_args,
            shell=(not bool(ps_path)),
            capture_output=True, text=True, timeout=60
        )
        if result.returncode == 0:
            out = result.stdout.strip()
            return out or "Success: Command executed with no visible output."
        return f"Command Failed! Error: {(result.stderr or result.stdout).strip()}"
    except subprocess.TimeoutExpired:
        return "Error: Command timed out after 60 seconds."
    except Exception as e:
        return f"Exception: {str(e)}"


def _write_file(filepath: str, content: str) -> str:
    print(f"  [TOOL] write_file: {filepath}")
    try:
        dirname = os.path.dirname(filepath)
        if dirname:
            os.makedirs(dirname, exist_ok=True)
        with open(filepath, "w", encoding="utf-8") as f:
            f.write(content)
        return f"Success: File successfully written at '{filepath}'."
    except Exception as e:
        return f"Error writing file: {str(e)}"


def _read_file(filepath: str) -> str:
    print(f"  [TOOL] read_file: {filepath}")
    try:
        if not os.path.exists(filepath):
            return f"Error: File '{filepath}' does not exist."
        with open(filepath, "r", encoding="utf-8") as f:
            return f.read()
    except Exception as e:
        return f"Error reading file: {str(e)}"


TOOLS_MAP = {
    "execute_command": _execute_command,
    "write_file":      _write_file,
    "read_file":       _read_file,
}

# ── Session store ─────────────────────────────────────────────────────────────
_sessions: dict = {}


def get_or_create_session(session_id: str):
    if session_id not in _sessions:
        config = types.GenerateContentConfig(
            system_instruction=SYSTEM_INSTRUCTION,
            temperature=0.2,
            tools=[TOOL_DECLARATIONS],
        )
        chat = client.chats.create(model="gemini-3.1-flash-lite", config=config)
        _sessions[session_id] = chat
        print(f"[Session] New: {session_id}")
    return _sessions[session_id]


def clear_session(session_id: str):
    if session_id in _sessions:
        del _sessions[session_id]
        print(f"[Session] Cleared: {session_id}")


# ── Agent loop ────────────────────────────────────────────────────────────────

def run_agent_turn(session_id: str, message: str, emit_event):
    """Runs one full agent turn. emit_event(name, data) streams updates to the UI."""
    chat = get_or_create_session(session_id)
    print(f"\n[Agent] User: {message[:120]}")
    try:
        emit_event("thinking", {})
        response = chat.send_message(message)

        # Log what the model returned
        fc_count = len(response.function_calls) if response.function_calls else 0
        print(f"[Agent] Model responded: function_calls={fc_count}, has_text={bool(response.text)}")
        if response.text and fc_count == 0:
            print(f"[Agent] Text (no tool call): {response.text[:200]}")

        # Tool-call loop
        while response.function_calls:
            print(f"[Agent] Executing {len(response.function_calls)} tool(s)")
            function_parts = []
            for fc in response.function_calls:
                name = fc.name
                args = dict(fc.args)
                print(f"[Agent]   -> {name}({list(args.keys())})")
                emit_event("tool_start", {"name": name, "args": args})

                fn = TOOLS_MAP.get(name)
                if fn:
                    result  = fn(**args)
                    success = not any(result.startswith(p) for p in ("Error", "Exception", "Command Failed"))
                else:
                    result  = f"Unknown tool: {name}"
                    success = False

                print(f"[Agent]   <- {result[:80]}")
                emit_event("tool_result", {"name": name, "result": result, "success": success})

                function_parts.append(
                    types.Part.from_function_response(
                        name=name,
                        response={"result": result},
                    )
                )

            emit_event("thinking", {})
            response = chat.send_message(function_parts)

        if response.text:
            print(f"[Agent] Final: {response.text[:80]}")
            emit_event("text_chunk", {"text": response.text})

        emit_event("message_end", {})

    except Exception as e:
        print(f"[Agent] ERROR: {e}")
        emit_event("error", {"message": str(e)})
