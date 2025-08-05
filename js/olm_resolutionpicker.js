import { app } from '../../scripts/app.js'


app.registerExtension({
    name: "olm.preview.respicker",

    async beforeRegisterNodeDef(nodeType, nodeData, app) {

        function floatsEqual(a, b, epsilon = 1e-10) {
            return Math.abs(a - b) < epsilon;
        }


        function roundToMultiple(value, multiple) {
            if (!multiple || isNaN(multiple) || multiple <= 0) return value;
            return Math.max(multiple, Math.round(value / multiple) * multiple);
        }


        function clampResolution(val, fallback = 512, min = 64, max = 8192) {
            let v = parseInt(val);
            if (isNaN(v)) return fallback;
            return Math.max(min, Math.min(v, max));
        }


        function setupSnapWidget(widget, getDivisibleValue, onSnap = () => { }) {
            if (!widget) return;

            const originalCallback = widget.callback;
            widget.callback = (value) => {
                const snap = parseInt(getDivisibleValue()) || 64;
                const snapped = roundToMultiple(value, snap);

                if (snapped !== value) {
                    widget.value = snapped;
                    onSnap(snapped);
                }

                if (originalCallback) originalCallback.call(widget, snapped);
            };
        }


        if (nodeData.name === "OlmResolutionPicker") {
            const originalOnNodeCreated = nodeType.prototype.onNodeCreated;
            const originalOnDrawForeground = nodeType.prototype.onDrawForeground;
            const originalOnConfigure = nodeType.prototype.onConfigure;
            const originalOnWidgetChanged = nodeType.prototype.onWidgetChanged;


            const TEST_IMAGE_PATH = "./extensions/ComfyUI-Olm-Resolution-Picker/test_image.png";

            const Layout = {
                MIN_WIDTH: 322,
                MIN_HEIGHT: 420,
                MIN_HEIGHT_NOPREV: 180,
                BASE_PREVIEW_WIDTH: 240,
                BASE_PREVIEW_HEIGHT: 180,
                PREVIEW_AREA_PADDING_X: 40,
                PREVIEW_AREA_PADDING_Y: 50,
                PREVIEW_AREA_SPACE_Y: 80,
                WIDGET_HEIGHT: 25,
                CUSTOM_SECTION_HEIGHT: 50,
            }


            nodeType.prototype.cacheWidgets = function () {
                if (!this.widgets) return;

                this.resolutionWidget ??= this.widgets.find(w => w.name === "resolution");
                this.checkerWidget ??= this.widgets.find(w => w.name === "show_checker");
                this.imageWidget ??= this.widgets.find(w => w.name === "show_image");
                this.swapFidget ??= this.widgets.find(w => w.name === "swap_dimensions");
                this.customWidthWidget ??= this.widgets.find(w => w.name === "custom_width");
                this.customHeightWidget ??= this.widgets.find(w => w.name === "custom_height");
                this.divisibleByWidget ??= this.widgets.find(w => w.name === "divisible_by");
                this.drawPreviewWidget ??= this.widgets.find(w => w.name === "draw_preview");
            };


            nodeType.prototype.onNodeCreated = function () {
                if (originalOnNodeCreated) {
                    originalOnNodeCreated.call(this);
                }

                this.resizable = true;

                this.previewImage = new Image();
                this.previewImage.onload = () => {
                    this.setDirtyCanvas(true, true);
                };
                this.previewImage.src = TEST_IMAGE_PATH;

                this.cacheWidgets();

                if (this.resolutionWidget) {
                    const originalCallback = this.resolutionWidget.callback;
                    this.resolutionWidget.callback = (value) => {
                        if (originalCallback) originalCallback.call(this.resolutionWidget, value);
                        this.updateCustomResolutionVisibility();
                        this.setDirtyCanvas(true, true);
                    };
                    this.updateCustomResolutionVisibility();
                }


                if (this.drawPreviewWidget) {
                    const originalCallback = this.drawPreviewWidget.callback;
                    this.drawPreviewWidget.callback = (value) => {
                        if (originalCallback) originalCallback.call(this.drawPreviewWidget, value);
                        this._needsResize = true;
                    };
                }

                setupSnapWidget(this.customWidthWidget, () => this.divisibleByWidget?.value, () => this.setDirtyCanvas(true, true));
                setupSnapWidget(this.customHeightWidget, () => this.divisibleByWidget?.value, () => this.setDirtyCanvas(true, true));
                this.setDirtyCanvas(true, true);
            }


            nodeType.prototype.onConfigure = function () {
                if (originalOnConfigure) {
                    originalOnConfigure.call(this);
                }
                this.cacheWidgets();
                this.updateCustomResolutionVisibility();
            }


            nodeType.prototype.onWidgetChanged = function (widget) {
                if (originalOnWidgetChanged) {
                    originalOnWidgetChanged.call(this, widget);
                }
                if (widget.name === "resolution") {
                    this.updateCustomResolutionVisibility();
                    this.setDirtyCanvas(true, true);
                }
            }


            nodeType.prototype.computeSize = function () {
                let height = 0;

                if (this.widgets) {
                    height += this.widgets.filter((w) => !w.hidden).length * Layout.WIDGET_HEIGHT;
                }

                if (this.shouldDrawPreview()) {
                    height += Layout.BASE_PREVIEW_HEIGHT;
                    height = Math.max(height, Layout.MIN_HEIGHT);
                }

                if (this.isCustomResolution()) {
                    height += Layout.CUSTOM_SECTION_HEIGHT;
                }

                return [Layout.MIN_WIDTH, Math.max(height, Layout.MIN_HEIGHT_NOPREV)];
            }


            nodeType.prototype.onDrawForeground = function (ctx) {
                if (originalOnDrawForeground) {
                    originalOnDrawForeground.call(this, ctx);
                }

                if (this.collapsed) return;

                if (this._needsResize) {
                    this.forceResize();
                }

                this.drawResolutionPreview(ctx);
            };


            nodeType.prototype.forceResize = function () {
                this._needsResize = false;
                const newSize = this.computeSize();
                if (newSize[1] !== this.size[1]) {
                    this.setSize(newSize);
                    this.setDirtyCanvas(true, true);
                }
            };


            nodeType.prototype.shouldDrawPreview = function () {
                return this.drawPreviewWidget?.value === true;
            };


            nodeType.prototype.shouldSwapDimensions = function () {
                return this.swapFidget?.value === true;
            };


            nodeType.prototype.isCustomResolution = function () {
                return this.resolutionWidget?.value?.toLowerCase().includes("custom");
            };


            nodeType.prototype.drawResolutionPreview = function (ctx) {

                if (!this.shouldDrawPreview()) return;

                ctx.save();

                const resolution = this.getActiveResolution();
                if (!resolution) {
                    ctx.restore();
                    return;
                }

                const { w, h } = resolution;
                const { x, y, previewWidth, previewHeight, scale } = this.calculatePreviewBounds(w, h);
                const { previewAspectRatio, rectX, rectY, rectWidth, rectHeight } = this.calculateAspectRect(x, y, w, h, previewWidth, previewHeight);

                this.drawFrameBackground(ctx, x, y, previewWidth, previewHeight);
                this.drawResolutionBox(ctx, rectX, rectY, rectWidth, rectHeight);
                this.drawPreviewImageIfNeeded(ctx, x, y, previewAspectRatio, previewWidth, previewHeight, rectX, rectY, rectWidth, rectHeight);
                this.drawCheckerboardIfNeeded(ctx, x, y, previewWidth, previewHeight, scale);
                this.drawPreviewFrameBorder(ctx, x, y, previewWidth, previewHeight);
                this.drawResolutionText(ctx, x, y, w, h, previewWidth, previewHeight);

                ctx.restore();
            };


            nodeType.prototype.getActiveResolution = function () {
                let w = 0, h = 0;

                if (this.isCustomResolution() && this.customWidthWidget && this.customHeightWidget) {
                    const rawW = clampResolution(this.customWidthWidget?.value);
                    const rawH = clampResolution(this.customHeightWidget?.value);
                    let snap = parseInt(this.divisibleByWidget?.value || "64");
                    if (isNaN(snap) || snap <= 0) snap = 64;
                    w = roundToMultiple(rawW, snap);
                    h = roundToMultiple(rawH, snap);
                } else {
                    const val = this.resolutionWidget?.value?.split(":")[0].trim();
                    [w, h] = val.split("x").map(Number);
                }

                if (isNaN(w) || isNaN(h)) return { w: 512, h: 512 };

                if (this.shouldSwapDimensions()) {
                    [w, h] = [h, w];
                }

                return { w, h };
            };


            nodeType.prototype.calculatePreviewBounds = function () {
                const nodeWidth = this.size[0];
                const nodeHeight = this.size[1];
                const widgetHeight = this.widgets?.filter(w => !w.hidden).length * Layout.WIDGET_HEIGHT || 0;

                const paddingX = Layout.PREVIEW_AREA_PADDING_X;
                const paddingY = Layout.PREVIEW_AREA_PADDING_Y;
                const spaceY = Layout.PREVIEW_AREA_SPACE_Y;

                const availableWidth = nodeWidth - paddingX;
                const availableHeight = nodeHeight - widgetHeight - spaceY;

                const maxScaleByWidth = availableWidth / Layout.BASE_PREVIEW_WIDTH;
                const maxScaleByHeight = availableHeight / Layout.BASE_PREVIEW_HEIGHT;
                const scale = Math.min(maxScaleByWidth, maxScaleByHeight, 3.0);

                const previewWidth = Layout.BASE_PREVIEW_WIDTH * scale;
                const previewHeight = Layout.BASE_PREVIEW_HEIGHT * scale;

                const x = (nodeWidth - previewWidth) / 2;
                const y = widgetHeight + paddingY + (availableHeight - previewHeight) / 2;

                return { x, y, previewWidth, previewHeight, scale };
            };


            nodeType.prototype.calculateAspectRect = function (x, y, w, h, previewWidth, previewHeight) {
                const aspect = w / h;
                const previewAspectRatio = previewWidth / previewHeight;

                let rectWidth = previewWidth;
                let rectHeight = previewHeight;

                if (aspect > previewAspectRatio) {
                    rectHeight = previewWidth / aspect;
                } else {
                    rectWidth = previewHeight * aspect;
                }

                const rectX = x + (previewWidth - rectWidth) / 2;
                const rectY = y + (previewHeight - rectHeight) / 2;

                return { previewAspectRatio, rectX, rectY, rectWidth, rectHeight };
            };


            nodeType.prototype.updateCustomResolutionVisibility = function () {
                const isCustom = this.isCustomResolution();

                const toggleWidgetVisibility = (widget, visible, width = Layout.MIN_WIDTH, height = Layout.WIDGET_HEIGHT) => {
                    if (!widget) return;

                    widget.hidden = !visible;
                    widget.computeSize = () => visible ? [width, height] : [0, -4];
                };

                // this._needsResize = true;

                toggleWidgetVisibility(this.customWidthWidget, isCustom);
                toggleWidgetVisibility(this.customHeightWidget, isCustom);
                toggleWidgetVisibility(this.divisibleByWidget, isCustom);
            };


            nodeType.prototype.drawResolutionBox = function (ctx, rectX, rectY, rectWidth, rectHeight) {
                ctx.fillStyle = "#ffffff";
                ctx.fillRect(rectX, rectY, rectWidth, rectHeight);
            }


            nodeType.prototype.drawPreviewImageIfNeeded = function (ctx, x, y, previewAspectRatio, previewWidth, previewHeight, rectX, rectY, rectWidth, rectHeight) {
                if (this.imageWidget?.value && this.previewImage) {
                    ctx.save();

                    const imageAspect = this.previewImage.width / this.previewImage.height;
                    let drawWidth, drawHeight, drawX, drawY;

                    if (imageAspect > previewAspectRatio) {
                        drawWidth = previewWidth;
                        drawHeight = previewWidth / imageAspect;
                    }
                    else if (floatsEqual(imageAspect, previewAspectRatio)) {
                        drawWidth = previewWidth;
                        drawHeight = previewHeight;
                    }
                    else {
                        drawWidth = previewHeight * imageAspect;
                        drawHeight = previewHeight;
                    }

                    drawX = x + (previewWidth - drawWidth) / 2;
                    drawY = y + (previewHeight - drawHeight) / 2;

                    ctx.beginPath();
                    ctx.rect(rectX, rectY, rectWidth, rectHeight);
                    ctx.clip();

                    ctx.drawImage(this.previewImage, drawX, drawY, drawWidth, drawHeight);

                    ctx.restore();
                }
            }


            nodeType.prototype.drawFrameBackground = function (ctx, x, y, previewWidth, previewHeight) {
                ctx.fillStyle = "#000000";
                ctx.fillRect(x, y, previewWidth, previewHeight);
            }


            nodeType.prototype.drawCheckerboardIfNeeded = function (ctx, x, y, previewWidth, previewHeight, scale) {
                if (this.checkerWidget?.value) {
                    ctx.save();
                    ctx.globalCompositeOperation = "multiply";

                    const checkSize = 16.0 * scale;
                    const cols = Math.ceil(previewWidth / checkSize);
                    const rows = Math.ceil(previewHeight / checkSize);

                    for (let col = 0; col < cols; col++) {
                        for (let row = 0; row < rows; row++) {
                            const isEven = (col + row) % 2 === 0;
                            ctx.fillStyle = isEven ? "#ffffff" : "#cccccc";

                            const xPos = x + col * checkSize;
                            const yPos = y + row * checkSize;

                            ctx.fillRect(
                                xPos,
                                yPos,
                                Math.min(checkSize, x + previewWidth - xPos),
                                Math.min(checkSize, y + previewHeight - yPos)
                            );
                        }
                    }

                    ctx.globalCompositeOperation = "source-over";
                    ctx.restore();
                }
            }


            nodeType.prototype.drawPreviewFrameBorder = function (ctx, x, y, previewWidth, previewHeight) {
                ctx.strokeStyle = "#555";
                ctx.lineWidth = 1;
                ctx.strokeRect(x, y, previewWidth, previewHeight);
            }


            nodeType.prototype.drawResolutionText = function (ctx, x, y, w, h, previewWidth, previewHeight) {
                ctx.fillStyle = "#ffffff";
                ctx.font = `10px Arial`;
                ctx.textAlign = "center";
                ctx.fillText(`${w}×${h}`, x + previewWidth / 2, y + previewHeight + Math.max(12, 12));
            }
        }
    }
});