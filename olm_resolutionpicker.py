import os

class OlmResolutionPicker:
    """
    Resolution Picker Node with:
    - Headers via -- in text file
    - Label support via ':' separator for descriptions
    - Comments with //
    - Validated and grouped dropdown menu
    """

    RESOLUTION_FILE = os.path.abspath(
        os.path.join(os.path.dirname(__file__), "resolutions.txt")
    )

    @classmethod
    def INPUT_TYPES(cls):
        options = cls.load_resolutions()
        return {
            "required": {
                "resolution": (options, {
                    "default": options[0] if options else "1024x1024"
                }),
                "show_checker": ("BOOLEAN", {"default": False}),
                "show_image": ("BOOLEAN", {"default": False}),
            }
        }

    @staticmethod
    def load_resolutions():
        print("RESOLUTION_FILE: ", OlmResolutionPicker.RESOLUTION_FILE)

        if not os.path.exists(OlmResolutionPicker.RESOLUTION_FILE):
            print("Resolution file missing. Using fallback defaults.")
            return ["512x512", "1024x1024"]

        with open(OlmResolutionPicker.RESOLUTION_FILE, "r") as f:
            lines = f.readlines()

        cleaned = []
        for line in lines:
            line = line.strip()

            if not line:
                continue

            if line.startswith("//"):
                continue

            if line.startswith("--"):
                header = line[2:].strip()
                cleaned.append(f"-- {header} --")
                continue

            if ":" in line:
                res_part, label = line.split(":", 1)
                res_part = res_part.strip()
                label = label.strip()
            else:
                res_part = line
                label = ""

            if "x" in res_part:
                try:
                    w, h = map(int, res_part.lower().split("x"))
                    if 64 <= w <= 8192 and 64 <= h <= 8192:
                        if label:
                            cleaned.append(f"{res_part}: {label}")
                        else:
                            cleaned.append(res_part)
                except ValueError:
                    continue

        return cleaned if cleaned else ["512x512"]

    RETURN_TYPES = ("INT", "INT")
    RETURN_NAMES = ("width", "height")

    FUNCTION = "pick"
    CATEGORY = "Utilities"

    def pick(self, resolution, show_checker=False, show_image=False):
        if resolution.startswith("--"):
            print(f"[OlmResolutionPicker] Ignored non-selectable header: '{resolution}'. Falling back to 1024x1024.")
            return (1024, 1024)

        base_res = resolution.split(":")[0].strip()
        try:
            width, height = map(int, base_res.lower().split("x"))
            return (width, height)
        except Exception as e:
            print(f"[Error] Failed to parse resolution '{resolution}': {e}")
            return (1024, 1024)

WEB_DIRECTORY = "./js"


NODE_CLASS_MAPPINGS = {
    "OlmResolutionPicker": OlmResolutionPicker,
}

NODE_DISPLAY_NAME_MAPPINGS = {
    "OlmResolutionPicker": "Olm Resolution Picker",
}
