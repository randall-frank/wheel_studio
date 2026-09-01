import argparse
import datetime
from functools import partial
import threading
from typing import Optional
import webbrowser
import zipfile
from http.server import SimpleHTTPRequestHandler, HTTPServer
import logging
import os
import shutil
import json
import glob
import copy
from ghp_import import ghp_import

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
    

def clean() -> None:
    """
    Clear out the "build" directory and remove any 'intermediate' build files
    
    :return:
    :rtype: None
    """
    try:
        shutil.rmtree("build")
    except OSError:
        pass


def build(post: bool = False, channel: str = "", auth: str = "") -> None:
    """
    Rebuild the "build" directory from scratch.
    
    :param post: If True, post to Discord.
    :type post: bool
    :param channel: The Discord channel to use for posting.
    :type channel: str
    :param auth: The Discord authentication token to use for posting.
    :type auth: str
    :return:
    :rtype: None
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
    group_list = []
    group = None
    title = None
    range: Optional[list] = None
    out_text = ""
    for line in wheel_scad.split("\n"):
        out_line = line.strip()
        if line.startswith("/* ["):
            start_idx = 4
            end_idx = line.find("] */", start_idx)
            name = line[start_idx:end_idx]
            if name != "Hidden":
                group = dict(name=name, children=[])
                group_list.append(group)
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
            child: dict = dict(key=key, title=title, value=value)
            if range:
                child["range"] = range
            group["children"].append(child)
            title = None
            # replace the value with a placeholder
            start_idx = out_line.find("=")
            end_idx = out_line.find(";")
            out_line = out_line[:start_idx+1] + " " + key.upper() + out_line[end_idx:]
        out_text += f"{out_line}\n"
        
    option_sets = [dict(name="Reset Defaults", params=group_list),dict(name="", params=[])]
    # option_sets.append(dict(name="", params=[]))
    # Add in the contents from the .json files in the presets directory
    for f in glob.glob(os.path.join("src", "presets","*.json")):
        header = dict(name=os.path.splitext(os.path.basename(f))[0].title(), params=[])
        option_sets.append(header)
        with open(f, "r") as json_file:
            data = json.load(json_file)
            if 'section_name' in data:
                header['name'] = data['section_name']
                log.info(f"New section name: {header['name']}")
            for name, params in data["parameterSets"].items():
                log.info(f"Scanning preset: {name} from {f}")
                option_sets.append(build_preset(name, params, group_list))


    js_params = json.dumps(option_sets, indent=4)
    js_params = f"var scad_params = {js_params};"
    with open(os.path.join("build", "wheel_params.js"), "w") as f:
        f.write(js_params)
    
    out_text = f"var scad_src = `{out_text}`;"
    with open(os.path.join("build", "wheel.js"), "w") as f:
        f.write(out_text)
            
    log.info("Build complete.")

def build_preset(name: str, params: dict, groups: list) -> dict:
    """
    Build a preset dictionary from the given name and parameters.
    
    :param name: The name of the preset.
    :type name: str
    :param params: The parameters for the preset.
    :type params: dict
    :param groups: The list of groups to use as a template.
    :type groups: list
    :return: A dictionary representing the preset.
    :rtype: dict
    """
    d = copy.deepcopy(groups)
    # walk 'd' and replace any keys that match 'params'
    for group in d:
        for item in group["children"]:
            key = item["key"]
            if key in params:
                item["value"] = params[key]

    return dict(name=name, params=d)

def release() -> None:
    """
    Generate a zip file of the contents of the "build" directory.

    :return: 
    :rtype: None
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

    :param url: The URL to open
    :type url: str
    :return: 
    :rtype: None
    """
    webbrowser.open_new_tab(url)


def serve(port: int = 9000, nobrowser: bool = False) -> None:
    """start an HTML server for the current game build

    This will serve the contents of the "build" directory on the specified port.

    :param port: The port to run the HTML server on. Defaults to 9000.
    :type port: int
    :param nobrowser: If true, do not attempt to open a web browser tab to the session. Defaults to False.
    :type nobrowser: bool
    :return: 
    :rtype: None
    """
    orig_cwd = os.getcwd()
    try:
        os.chdir("build")
        server_address = ('127.0.0.1', port)
        httpd = HTTPServer(server_address, SimpleHTTPRequestHandler)
        url = f"http://{server_address[0]}:{server_address[1]}"
        log.info(f"Serving application:  {url}")
        if not nobrowser:
            log.info(f"Opening a browsing tab.")
            bound_open_url = partial(open_url, url)
            timer = threading.Timer(5, bound_open_url)
            timer.start()
        httpd.serve_forever()
    except KeyboardInterrupt:
        pass
    finally:
        os.chdir(orig_cwd)
    log.info("Server stopped.")


def gh_pages(commit_str: str = "Update pages") -> None:
    """
    Deploy the current build directory to GitHub Pages.
    
    :param commit_str: Commit message for the deployment.
    :type commit_str: str
    :return: 
    :rtype: None
    """
    # Check if we are in a git repository
    if not os.path.exists(".git"):
        log.error("Not in a git repository")
    build()
    ghp_import('build', push=True, mesg=commit_str)
    

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
    
    gh_pages_parser = cmd_parsers.add_parser("ghpages", help="Rebuild & push 'build' directory to 'gh_pages' branch")
    gh_pages_parser.add_argument("--ghmsg", help=f"Commit message. default:'Release version:{__version__}'", 
                                 default=f"Release version:{__version__}")
    
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
    elif args.cmd == "ghpages":
        gh_pages(commit_str=args.ghmsg)
    else:
        print(f"Unknown command: {args.cmd}")
        parser.print_help()
        exit(-1)
        
    log.info("Operation complete")
    
    exit(0)

