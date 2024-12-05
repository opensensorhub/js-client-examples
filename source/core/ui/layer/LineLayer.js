/***************************** BEGIN LICENSE BLOCK ***************************

 TODO

 ******************************* END LICENSE BLOCK ***************************/

import Layer from "./Layer.js";
import { isDefined } from "../../utils/Utils.js";

/**
 * @extends Layer
 * @example
 *
 * xxx
 */
class LineLayer extends Layer {
    /**
     * Creates the LineLayer
     * @param {Object} properties
     * xxx
     */
    constructor(properties) {
        super(properties);
        this.type = 'polyline';
    }

    // called by super class
    init(properties=this.properties) {
        super.init(properties);
        const props = {};
    }

    clear() {
        const currentProps = this.getCurrentProps();
        currentProps.locations = [];
    }
}

export default LineLayer;
