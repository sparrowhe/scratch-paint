import paper from '@scratch/paper';
import Modes from '../../modes/modes';
import {styleShape} from '../style-path';
import {clearSelection} from '../selection';
import BoundingBoxTool from '../selection-tools/bounding-box-tool';

/**
 * Tool for drawing ovals.
 */
class OvalTool extends paper.Tool {
    static get TOLERANCE () {
        return 6;
    }
    /**
     * @param {function} setSelectedItems Callback to set the set of selected items in the Redux state
     * @param {function} clearSelectedItems Callback to clear the set of selected items in the Redux state
     * @param {!function} onUpdateSvg A callback to call when the image visibly changes
     */
    constructor (setSelectedItems, clearSelectedItems, onUpdateSvg) {
        super();
        this.clearSelectedItems = clearSelectedItems;
        this.onUpdateSvg = onUpdateSvg;
        this.prevHoveredItemId = null;
        this.boundingBoxTool = new BoundingBoxTool(Modes.OVAL, setSelectedItems, clearSelectedItems, onUpdateSvg);
        
        // We have to set these functions instead of just declaring them because
        // paper.js tools hook up the listeners in the setter functions.
        this.onMouseDown = this.handleMouseDown;
        this.onMouseDrag = this.handleMouseDrag;
        this.onMouseUp = this.handleMouseUp;
        this.onKeyUp = this.handleKeyUp;

        this.oval = null;
        this.colorState = null;
        this.isBoundingBoxMode = null;
        this.active = false;
    }
    getHitOptions () {
        return {
            segments: true,
            stroke: true,
            curves: true,
            fill: true,
            guide: false,
            match: hitResult =>
                (hitResult.item.data && hitResult.item.data.isHelperItem) ||
                hitResult.item.selected, // Allow hits on bounding box and selected only
            tolerance: OvalTool.TOLERANCE / paper.view.zoom
        };
    }
    /**
     * Should be called if the selection changes to update the bounds of the bounding box.
     * @param {Array<paper.Item>} selectedItems Array of selected items.
     */
    onSelectionChanged (selectedItems) {
        this.boundingBoxTool.onSelectionChanged(selectedItems);
    }
    setColorState (colorState) {
        this.colorState = colorState;
    }
    handleMouseDown (event) {
        if (event.event.button > 0) return; // only first mouse button
        this.active = true;

        if (this.boundingBoxTool.onMouseDown(event, false /* clone */, false /* multiselect */, this.getHitOptions())) {
            this.isBoundingBoxMode = true;
        } else {
            this.isBoundingBoxMode = false;
            clearSelection(this.clearSelectedItems);
            this.oval = new paper.Shape.Ellipse({
                point: event.downPoint,
                size: 0
            });
            styleShape(this.oval, this.colorState);
        }
    }
    handleMouseDrag (event) {
        if (event.event.button > 0 || !this.active) return; // only first mouse button

        if (this.isBoundingBoxMode) {
            this.boundingBoxTool.onMouseDrag(event);
            return;
        }

        const downPoint = new paper.Point(event.downPoint.x, event.downPoint.y);
        const point = new paper.Point(event.point.x, event.point.y);
        if (event.modifiers.shift) {
            this.oval.size = new paper.Point(event.downPoint.x - event.point.x, event.downPoint.x - event.point.x);
        } else {
            this.oval.size = downPoint.subtract(point);
        }
        if (event.modifiers.alt) {
            this.oval.position = downPoint;
        } else {
            this.oval.position = downPoint.subtract(this.oval.size.multiply(0.5));
        }
        
    }
    handleMouseUp (event) {
        if (event.event.button > 0 || !this.active) return; // only first mouse button
        
        if (this.isBoundingBoxMode) {
            this.boundingBoxTool.onMouseUp(event);
            this.isBoundingBoxMode = null;
            return;
        }

        if (this.oval) {
            if (Math.abs(this.oval.size.width * this.oval.size.height) < OvalTool.TOLERANCE / paper.view.zoom) {
                // Tiny oval created unintentionally?
                this.oval.remove();
                this.oval = null;
            } else {
                const ovalPath = this.oval.toPath(true /* insert */);
                this.oval.remove();
                this.oval = null;

                ovalPath.selected = true;
                this.boundingBoxTool.setSelectionBounds();
                this.onUpdateSvg();
            }
        }
        this.active = false;
    }
    deactivateTool () {
        this.boundingBoxTool.removeBoundsPath();
    }
}

export default OvalTool;
