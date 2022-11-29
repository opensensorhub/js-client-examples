import Layer from "../../../../source/core/ui/layer/Layer";
import {isDefined} from "../../utils/Utils";

class frustumLayer extends Layer {
    /**
     */
    constructor(properties) {
        super(properties);
        this.type = 'frustum';
    }
    // call by super class
    init(properties=this.properties) {
        super.init(properties);
        const props = {
            color : 'rgb(255,0,0)',
            opacity : 0.5,
            origin : null,
            fov : null,
            near : 0.009,
            range : null,
            platformOrientation : {heading: 0.0, pitch: 0.0, roll: 0.0},
            sensorOrientation : {yaw: 0.0, pitch: 0.0, roll: 0.0}
        };

        if(isDefined(properties.color)){
            props.color = properties.color;
        }

        if(isDefined(properties.opacity)){
            props.opacity = properties.opacity;
        }

        this.definedId('frustumId', props);

        if(isDefined(properties.getColor)) {
            let fn = async (rec, timestamp, options) => {
                this.updateProperty('color',await this.getFunc('getColor')(rec, timestamp, options));
            };
            this.addFn(this.getDataSourcesIdsByProperty('getColor'),fn);
        }

        if(isDefined(properties.getOrigin)) {
            let fn = async (rec, timestamp, options) => {
                this.updateProperty('origin',await this.getFunc('getOrigin')(rec, timestamp, options));
            };
            this.addFn(this.getDataSourcesIdsByProperty('getOrigin'),fn);
        }

        if(isDefined(properties.getFov)) {
            let fn = async (rec, timestamp, options) => {
                this.updateProperty('fov',await this.getFunc('getFov')(rec, timestamp, options));
            };
            this.addFn(this.getDataSourcesIdsByProperty('getFov'),fn);
        }

        if(isDefined(properties.getRange)) {
            let fn = async (rec, timestamp, options) => {
                this.updateProperty('range',await this.getFunc('getRange')(rec, timestamp, options));
            };
            this.addFn(this.getDataSourcesIdsByProperty('getRange'),fn);
        }

        if(isDefined(properties.getPlatformOrientation)) {
            let fn = async (rec, timestamp, options) => {
                this.updateProperty('platformOrientation',await this.getFunc('getPlatformOrientation')(rec, timestamp, options));
            };
            this.addFn(this.getDataSourcesIdsByProperty('getPlatformOrientation'),fn);
        }

        if(isDefined(properties.getSensorOrientation)) {
            let fn = async (rec, timestamp, options) => {
                this.updateProperty('sensorOrientation',await this.getFunc('getSensorOrientation')(rec, timestamp, options));
            };
            this.addFn(this.getDataSourcesIdsByProperty('getSensorOrientation'),fn);
        }
    }
}

export default  frustumLayer;
