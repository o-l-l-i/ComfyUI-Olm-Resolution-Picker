// @ts-ignore
import { app } from '../../scripts/app.js'


app.registerExtension({
    name: "olm.preview.respicker",

    async setup() {},

    async beforeRegisterNodeDef(nodeType, nodeData, app) {

        function floatsEqual(a, b, epsilon = 1e-10) {
            return Math.abs(a - b) < epsilon;
        }

        nodeType.prototype.cacheWidgets = function () {
            if (!this.widgets) return;

            this.resolutionWidget ??= this.widgets.find(w => w.name === "resolution");
            this.checkerWidget ??= this.widgets.find(w => w.name === "show_checker");
            this.imageWidget ??= this.widgets.find(w => w.name === "show_image");
        };

        const MIN_WIDTH = 322;
        const MIN_HEIGHT = 220;
        const PREVIEW_WIDTH = 240;
        const PREVIEW_HEIGHT = 180;
        const TEST_IMAGE_PATH = "./extensions/ComfyUI-Olm-Resolution-Picker/test_image.png";

        if (nodeData.name === "OlmResolutionPicker") {
            const originalOnNodeCreated = nodeType.prototype.onNodeCreated;
            const originalOnDrawForeground = nodeType.prototype.onDrawForeground;
            const originalOnWidgetChanged = nodeType.prototype.onWidgetChanged;
            const originalOnConfigure = nodeType.prototype.onConfigure;

            nodeType.prototype.onNodeCreated = function() {
                console.log("onNodeCreated");

                if (originalOnNodeCreated) {
                    originalOnNodeCreated.call(this);
                }

                this.min_size = [MIN_WIDTH, MIN_HEIGHT];
                this.resizable = true;

                this.previewImage = new Image();
                this.previewImage.onload = () => {
                    this.setDirtyCanvas(true, true);
                };
                this.previewImage.src = TEST_IMAGE_PATH;

                this.cacheWidgets();

                console.log("Widgets initialized:", {
                    resolution: this.resolutionWidget,
                    checker: this.checkerWidget,
                    image: this.imageWidget
                });

                this.setDirtyCanvas(true, true);
            }

            nodeType.prototype.computeSize = function() {
                let width = MIN_WIDTH;
                let height = MIN_HEIGHT;

                if (this.widgets) {
                    height += this.widgets.length * 25;
                }
                height += 80;

                return [width, height];
            }

            nodeType.prototype.onConfigure = function() {
                if (originalOnConfigure) {
                    originalOnConfigure.call(this);
                }

                this.cacheWidgets();
            }

            nodeType.prototype.onDrawForeground = function(ctx) {
                if (originalOnDrawForeground) {
                    originalOnDrawForeground.call(this, ctx);
                }

                if(this.collapsed) return;

                this.drawResolutionPreview(ctx);
            };

            nodeType.prototype.drawResolutionPreview = function(ctx) {

                ctx.save();

                const resolutionWidget = this.resolutionWidget || this.widgets?.find(w => w.name === "resolution");
                if (!resolutionWidget) {
                    ctx.restore();
                    return;
                }

                const val = resolutionWidget.value?.split(":")[0].trim();
                const [w, h] = val.split("x").map(Number);

                if (isNaN(w) || isNaN(h)) {
                    ctx.restore();
                    return;
                }

                const width = this.size[0];
                const height = this.size[1];
                const x = width - (width/2) - PREVIEW_WIDTH/2;
                const y = height - (height/3) - 20 - PREVIEW_HEIGHT/3;

                const aspectRatio = w / h;
                let rectWidth = PREVIEW_WIDTH;
                let rectHeight = PREVIEW_HEIGHT;

                if (aspectRatio > PREVIEW_WIDTH / PREVIEW_HEIGHT) {
                    rectHeight = PREVIEW_WIDTH / aspectRatio;
                } else {
                    rectWidth = PREVIEW_HEIGHT * aspectRatio;
                }

                const rectX = x + (PREVIEW_WIDTH - rectWidth) / 2;
                const rectY = y + (PREVIEW_HEIGHT - rectHeight) / 2;

                ctx.fillStyle = "#000000";
                ctx.fillRect(x, y, PREVIEW_WIDTH, PREVIEW_HEIGHT);

                ctx.fillStyle = "#ffffff";

                ctx.fillRect(rectX, rectY, rectWidth, rectHeight);

                if (this.imageWidget?.value && this.previewImage) {

                    ctx.save();

                    const imageAspect = this.previewImage.width / this.previewImage.height;
                    const previewAspect = PREVIEW_WIDTH / PREVIEW_HEIGHT;

                    let drawWidth, drawHeight, drawX, drawY;

                    if (imageAspect > previewAspect) {
                        drawWidth = PREVIEW_WIDTH;
                        drawHeight = PREVIEW_WIDTH / imageAspect;
                    }
                    else if (floatsEqual(imageAspect, previewAspect)) {
                        drawWidth = PREVIEW_WIDTH;
                        drawHeight = PREVIEW_HEIGHT;
                    }
                    else {
                        drawWidth = PREVIEW_HEIGHT * imageAspect;
                        drawHeight = PREVIEW_HEIGHT;
                    }

                    drawX = x + (PREVIEW_WIDTH - drawWidth) / 2;
                    drawY = y + (PREVIEW_HEIGHT - drawHeight) / 2;

                    ctx.beginPath();
                    ctx.rect(rectX, rectY, rectWidth, rectHeight);
                    ctx.clip();

                    ctx.drawImage(this.previewImage, drawX, drawY, drawWidth, drawHeight);

                    ctx.restore();
                }

                if (this.checkerWidget?.value) {
                    ctx.globalCompositeOperation = "multiply";

                    const checkSize = 16;
                    for (let i = 0; i < PREVIEW_WIDTH; i += checkSize) {
                        for (let j = 0; j < PREVIEW_HEIGHT; j += checkSize) {
                            const isEven = (Math.floor(i / checkSize) + Math.floor(j / checkSize)) % 2;
                            ctx.fillStyle = isEven ? "#ffffff" : "#cccccc";
                            ctx.fillRect(x + i, y + j,
                                Math.min(checkSize, PREVIEW_WIDTH - i),
                                Math.min(checkSize, PREVIEW_HEIGHT - j));
                        }
                    }
                    ctx.globalCompositeOperation = "source-over";
                }

                ctx.strokeStyle = "#555";
                ctx.lineWidth = 1;
                ctx.strokeRect(x, y, PREVIEW_WIDTH, PREVIEW_HEIGHT);

                ctx.fillStyle = "#ffffff";
                ctx.font = "10px Arial";
                ctx.textAlign = "center";
                ctx.fillText(`${w}×${h}`, x + PREVIEW_WIDTH / 2, y + PREVIEW_HEIGHT + 12);

                ctx.restore();
            };

            nodeType.prototype.onWidgetChanged = function(widget, value, old_value, app) {
                if (originalOnWidgetChanged) {
                    originalOnWidgetChanged.call(this, widget, value, old_value, app);
                }
                if (widget.name === "resolution") {
                    this.resolutionWidget = widget;
                    this.setDirtyCanvas(true, true);
                } else if (widget.name === "show_checker") {
                    this.checkerWidget = widget;
                    this.setDirtyCanvas(true, true);
                } else if (widget.name === "show_image") {
                    this.imageWidget = widget;
                    this.setDirtyCanvas(true, true);
                }
            };
        }
    }
});