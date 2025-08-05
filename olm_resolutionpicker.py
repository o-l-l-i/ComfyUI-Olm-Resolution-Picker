import os


DEBUG_MODE = False


def debug_print(*args, **kwargs):
    if DEBUG_MODE:
        print(*args, **kwargs)


class OlmResolutionPicker:

    RESOLUTION_FILE = os.path.abspath(
        os.path.join(os.path.dirname(__file__), "resolutions.txt")
    )

    @classmethod
    def INPUT_TYPES(cls):
        options = cls.load_resolutions()
        return {
            "required": {
                "resolution": (
                    options,
                    {"default": options[0] if options else "1024x1024"},
                ),
                "draw_preview": ("BOOLEAN", {"default": True}),
                "show_checker": ("BOOLEAN", {"default": False}),
                "show_image": ("BOOLEAN", {"default": False}),
                "swap_dimensions": ("BOOLEAN", {"default": False}),
                "custom_width": (
                    "INT",
                    {"default": 512, "min": 64, "max": 8192, "step": 1},
                ),
                "custom_height": (
                    "INT",
                    {"default": 512, "min": 64, "max": 8192, "step": 1},
                ),
                "divisible_by": (
                    ["1", "2", "4", "8", "16", "32", "64"],
                    {"default": "64"},
                ),
            }
        }

    @staticmethod
    def load_resolutions():
        debug_print(
            "[OlmResolutionPicker] Resolution file: ",
            OlmResolutionPicker.RESOLUTION_FILE,
        )

        if not os.path.exists(OlmResolutionPicker.RESOLUTION_FILE):
            debug_print(
                "[OlmResolutionPicker] Resolution file missing. Using fallback defaults."
            )
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

        if not cleaned:
            cleaned = ["512x512"]

        if "Custom" not in cleaned:
            cleaned.append("Custom")

        return cleaned

    RETURN_TYPES = ("INT", "INT")
    RETURN_NAMES = ("width", "height")

    FUNCTION = "pick"
    CATEGORY = "Utilities"

    def pick(
        self,
        resolution,
        draw_preview,
        show_checker,
        show_image,
        swap_dimensions,
        custom_width=512,
        custom_height=512,
        divisible_by="64",
    ):

        def round_to_multiple(value, multiple):
            return max(multiple, round(value / multiple) * multiple)

        if resolution.strip().lower() == "custom":
            try:
                snap = int(divisible_by)
            except:
                snap = 64

            width = round_to_multiple(custom_width, snap)
            height = round_to_multiple(custom_height, snap)

            width = max(64, min(width, 8192))
            height = max(64, min(height, 8192))
        else:
            if resolution.startswith("--"):
                debug_print(
                    f"[OlmResolutionPicker] Ignored header: '{resolution}', fallback to 1024x1024."
                )
                return (1024, 1024)

            base_res = resolution.split(":")[0].strip()
            try:
                width, height = map(int, base_res.lower().split("x"))
            except Exception as e:
                debug_print(
                    f"[OlmResolutionPicker] Failed to parse resolution '{resolution}': {e}"
                )
                return (1024, 1024)

        if swap_dimensions:
            width, height = height, width

        return (width, height)


WEB_DIRECTORY = "./js"


NODE_CLASS_MAPPINGS = {
    "OlmResolutionPicker": OlmResolutionPicker,
}


NODE_DISPLAY_NAME_MAPPINGS = {
    "OlmResolutionPicker": "Olm Resolution Picker",
}
