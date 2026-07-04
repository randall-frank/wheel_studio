import argparse
import datetime
from functools import partial
import threading
import webbrowser
import zipfile
from http.server import SimpleHTTPRequestHandler, HTTPServer
import logging
import os
import shutil
import json

try:
    import git
    repo = git.Repo(".")
    branch_name = repo.active_branch.name
    branch_sha = repo.active_branch.commit.hexsha
    __version_git__ = f"{branch_name}:{branch_sha}"
except:
    __version_git__ = ""


# Get the current version number
with open("version.txt", "r") as f:
    __version__ = f.read().strip()
    
# Get the current time/date
__version_date__ = datetime.datetime.now().isoformat(timespec='minutes', sep=" ") 
    
"""
Command line build tool:

python build.py [operation] [options]

Operations:

clean
build
release
serve [--port port] [--nobrowser]

"""



def clean() -> None:
    """
    Clear out the "build" directory and remove any 'intermediate' build files
    :param remove_cli_tools: bool If True, remove the ink_tools directory as well.
    :return:
    """
    try:
        shutil.rmtree("build")
    except OSError:
        pass


def build(post: bool = False, channel: str = "", auth: str = "") -> None:
    """
    Rebuild the "build" directory from scratch.
    
    :param post: bool If True, post to Discord.
    :param channel: str The Discord channel to use for posting.
    :param auth: str The Discord authentication token to use for posting.
    :return:
    """
    # Complete rebuild
    clean()
    try:
        os.mkdir("build")
    except OSError:
        pass
    
    with open(os.path.join("src", "index.html"), "r") as f:
        index_html = f.read()
    index_html = index_html.replace("VERSION_GIT", __version_git__)
    index_html = index_html.replace("VERSION_DATE", __version_date__)
    index_html = index_html.replace("VERSION", __version__)
    with open(os.path.join("build", "index.html"), "w") as f:
        f.write(index_html)
    for sub in ("css", "js", "openscad", "threejs", "images"):
        shutil.copytree(os.path.join("src", sub), os.path.join("build", sub), dirs_exist_ok=True)
    shutil.copyfile(os.path.join("src", "main.js"), os.path.join("build", "main.js"))
    with open(os.path.join("src", "wheel.scad"), "r") as f:
        wheel_scad = f.read()
    
    # Extract the parameters from the .scad source
    parameters = []
    group = None
    title = None
    range = None
    out_text = ""
    for line in wheel_scad.split("\n"):
        out_line = line.strip()
        if line.startswith("/* ["):
            start_idx = 4
            end_idx = line.find("] */", start_idx)
            name = line[start_idx:end_idx]
            if name != "Hidden":
                group = dict(name=name, children=[])
                parameters.append(group)
            else:
                group = None
        elif group is not None and line.startswith("// "):
            title = line[2:].strip()
        elif group is not None and title is not None:
            key = line.split("=")[0].strip()
            value = line.split("=")[1].strip().replace(";", "")
            idx = value.find("//")
            if idx != -1:
                tmp = value[idx+2:].replace("[",":").replace("]",":")
                range = tmp.split(":")[1:3]
                value = value[:idx].strip()
            else:
                range = None
            child = dict(key=key, title=title, value=value)
            if range:
                child["range"] = range
            group["children"].append(child)
            title = None
            # replace the value with a placeholder
            start_idx = out_line.find("=")
            end_idx = out_line.find(";")
            out_line = out_line[:start_idx+1] + " " + key.upper() + out_line[end_idx:]
        out_text += f"{out_line}\n"
        
    option_sets = [dict(name="Default", params=parameters)]
    js_params = json.dumps(option_sets, indent=4)
    js_params = f"var scad_params = {js_params};"
    with open(os.path.join("build", "wheel_params.js"), "w") as f:
        f.write(js_params)
    
    out_text = f"var scad_src = `{out_text}`;"
    with open(os.path.join("build", "wheel.js"), "w") as f:
        f.write(out_text)
            
    print("Build complete.")


def release() -> None:
    """
    Generate a zip file of the contents of the "build" directory.

    :return:
    """
    build()
    filename = f"wheels_v{__version__.replace('.', '_')}.zip"
    with zipfile.ZipFile(filename, "w", zipfile.ZIP_DEFLATED) as zpf:
        for root, dirs, files in os.walk("build"):
            for file in files:
                src = os.path.join(root, file)
                arcname = os.path.relpath(src, os.path.join("build"))
                zpf.write(src, arcname=arcname)


def open_url(url: str) -> None:
    """open a URL in a new tab using webbrowser

    Args:
        url (str): the URL to open
    :return:
    """
    webbrowser.open_new_tab(url)


def serve(port: int = 9000, nobrowser: bool = False) -> None:
    """start an HTML server for the current game build

    This will serve the contents of the "build" directory on the specified port.

    :param port: int  The port to run the HTML server on. Defaults to 9000.
    :param nobrowser: bool If true, do not attempt to open a web browser tab to the session. Defaults to False.
    :return:
    """
    orig_cwd = os.getcwd()
    try:
        os.chdir("build")
        server_address = ('127.0.0.1', port)
        httpd = HTTPServer(server_address, SimpleHTTPRequestHandler)
        url = f"http://{server_address[0]}:{server_address[1]}"
        print(f"Serving application:  {url}")
        if not nobrowser:
            print(f"Opening a browsing tab.")
            bound_open_url = partial(open_url, url)
            timer = threading.Timer(5, bound_open_url)
            timer.start()
        httpd.serve_forever()
    except KeyboardInterrupt:
        pass
    finally:
        os.chdir(orig_cwd)
    print("Server stopped.")


if __name__ == "__main__":
    parser = argparse.ArgumentParser()
    parser.add_argument(
        "-V",
        "--version",
        action="version",
        version="%(prog)s {version}".format(version=__version__),
    )
    parser.add_argument("--verbose", action="store_true", default=False, help="Run in verbose mode")
    parser.add_argument("--logfile", help="Log file for verbose output", default="")
    
    cmd_parsers = parser.add_subparsers(help="Command", dest="cmd")
    cmd_parsers.required = True

    build_parser = cmd_parsers.add_parser("build", aliases=["fullbuild"],
                                          help="Rebuild the entire build directory contents")

    clean_parser = cmd_parsers.add_parser("clean", help="Remove all build directory contents")

    serve_parser = cmd_parsers.add_parser("serve", help="Server the build via http")
    serve_parser.add_argument("--port", type=int, default=9000, help="The port to use. Default: 9000")
    serve_parser.add_argument("--nobrowser", action="store_true", default=False,
                              help="Do not automatically open a web browser tab to the server.")

    release_parser = cmd_parsers.add_parser("release", help="Rebuild & generate a tarball of 'build' directory")

    args = parser.parse_args()

    # Set up logging
    level = logging.INFO
    if args.verbose:
        level = logging.DEBUG
    log = logging.getLogger("wheels_build")
    logging.basicConfig(filename=args.logfile, level=level)
    log.debug(f"Command line args: {args}")
    
    if args.cmd.endswith("build"):
        build()
    elif args.cmd == "release":
        release()
    elif args.cmd == "clean":
        clean()
    elif args.cmd == "serve":
        serve(port=args.port, nobrowser=args.nobrowser)
    
    log.info("Operation complete")
    
    exit(0)

