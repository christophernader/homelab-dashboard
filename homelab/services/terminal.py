"""Terminal WebSocket service for cross-platform shell access."""

import os
import platform
import subprocess
import struct
from threading import Thread

# Unix-specific imports (will fail on Windows but that's handled)
try:
    import pty
    import select
    import fcntl
    import termios
    HAS_PTY = True
except ImportError:
    HAS_PTY = False


def handle_terminal_websocket(ws):
    """
    WebSocket handler for terminal access - cross-platform.

    Args:
        ws: WebSocket connection from flask-sock
    """
    system = platform.system()

    if system == 'Windows':
        _handle_windows_terminal(ws)
    else:
        _handle_unix_terminal(ws)


def _handle_windows_terminal(ws):
    """Handle terminal on Windows using subprocess."""
    shell = os.environ.get('COMSPEC', 'cmd.exe')
    try:
        # Try PowerShell first
        process = subprocess.Popen(
            ['powershell.exe', '-NoLogo', '-NoProfile'],
            stdin=subprocess.PIPE,
            stdout=subprocess.PIPE,
            stderr=subprocess.STDOUT,
            bufsize=0,
            creationflags=subprocess.CREATE_NEW_PROCESS_GROUP
        )
    except Exception:
        process = subprocess.Popen(
            [shell],
            stdin=subprocess.PIPE,
            stdout=subprocess.PIPE,
            stderr=subprocess.STDOUT,
            bufsize=0
        )

    def read_and_send():
        """Read from process stdout and send to WebSocket."""
        try:
            while process.poll() is None:
                output = process.stdout.read(1024)
                if output:
                    try:
                        ws.send(output.decode('utf-8', errors='replace'))
                    except Exception:
                        break
        except Exception:
            pass

    reader_thread = Thread(target=read_and_send, daemon=True)
    reader_thread.start()

    try:
        while True:
            data = ws.receive()
            if data is None:
                break
            if not data.startswith('\x1b[8;'):  # Skip resize on Windows
                process.stdin.write(data.encode('utf-8'))
                process.stdin.flush()
    except Exception:
        pass
    finally:
        process.terminate()


def _handle_unix_terminal(ws):
    """Handle terminal on Unix/macOS using PTY."""
    if not HAS_PTY:
        ws.send("PTY not available on this system\r\n")
        return

    master_fd, slave_fd = pty.openpty()

    # Get user's default shell with login profile
    shell = os.environ.get('SHELL', '/bin/bash')

    # Build comprehensive environment with user's PATH
    shell_env = os.environ.copy()
    shell_env.update({
        'TERM': 'xterm-256color',
        'COLORTERM': 'truecolor',
        'COLUMNS': '120',
        'LINES': '30',
        'LC_ALL': 'en_US.UTF-8',
        'LANG': 'en_US.UTF-8',
    })
    # Remove variables that interfere with SSH password prompts
    shell_env.pop('SSH_ASKPASS', None)
    shell_env.pop('DISPLAY', None)
    shell_env.pop('SSH_ASKPASS_REQUIRE', None)

    # Function to set up controlling terminal
    def setup_tty():
        os.setsid()
        # Set as controlling terminal
        fcntl.ioctl(slave_fd, termios.TIOCSCTTY, 0)

    # Spawn interactive login shell to get proper PATH
    process = subprocess.Popen(
        [shell, '-il'],  # -i interactive, -l login shell
        stdin=slave_fd,
        stdout=slave_fd,
        stderr=slave_fd,
        preexec_fn=setup_tty,
        env=shell_env,
        cwd=os.path.expanduser('~')
    )

    os.close(slave_fd)

    # Set non-blocking
    flags = fcntl.fcntl(master_fd, fcntl.F_GETFL)
    fcntl.fcntl(master_fd, fcntl.F_SETFL, flags | os.O_NONBLOCK)

    def read_and_send():
        """Read from PTY and send to WebSocket."""
        try:
            while process.poll() is None:
                try:
                    r, _, _ = select.select([master_fd], [], [], 0.1)
                    if master_fd in r:
                        output = os.read(master_fd, 4096)
                        if output:
                            try:
                                ws.send(output.decode('utf-8', errors='replace'))
                            except Exception:
                                break
                except (OSError, IOError):
                    break
        except Exception:
            pass

    reader_thread = Thread(target=read_and_send, daemon=True)
    reader_thread.start()

    try:
        while True:
            data = ws.receive()
            if data is None:
                break

            # Handle resize command
            if data.startswith('\x1b[8;'):
                try:
                    parts = data[4:-1].split(';')
                    rows, cols = int(parts[0]), int(parts[1])
                    winsize = struct.pack('HHHH', rows, cols, 0, 0)
                    fcntl.ioctl(master_fd, termios.TIOCSWINSZ, winsize)
                except Exception:
                    pass
            else:
                os.write(master_fd, data.encode('utf-8'))
    except Exception:
        pass
    finally:
        process.terminate()
        try:
            process.wait(timeout=1)
        except Exception:
            process.kill()
        os.close(master_fd)
