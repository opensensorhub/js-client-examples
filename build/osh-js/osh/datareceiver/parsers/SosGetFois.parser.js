var __extends = (this && this.__extends) || (function () {
    var extendStatics = function (d, b) {
        extendStatics = Object.setPrototypeOf ||
            ({ __proto__: [] } instanceof Array && function (d, b) { d.__proto__ = b; }) ||
            function (d, b) { for (var p in b) if (Object.prototype.hasOwnProperty.call(b, p)) d[p] = b[p]; };
        return extendStatics(d, b);
    };
    return function (d, b) {
        if (typeof b !== "function" && b !== null)
            throw new TypeError("Class extends value " + String(b) + " is not a constructor or null");
        extendStatics(d, b);
        function __() { this.constructor = d; }
        d.prototype = b === null ? Object.create(b) : (__.prototype = b.prototype, new __());
    };
})();
var __assign = (this && this.__assign) || function () {
    __assign = Object.assign || function(t) {
        for (var s, i = 1, n = arguments.length; i < n; i++) {
            s = arguments[i];
            for (var p in s) if (Object.prototype.hasOwnProperty.call(s, p))
                t[p] = s[p];
        }
        return t;
    };
    return __assign.apply(this, arguments);
};
var __awaiter = (this && this.__awaiter) || function (thisArg, _arguments, P, generator) {
    function adopt(value) { return value instanceof P ? value : new P(function (resolve) { resolve(value); }); }
    return new (P || (P = Promise))(function (resolve, reject) {
        function fulfilled(value) { try { step(generator.next(value)); } catch (e) { reject(e); } }
        function rejected(value) { try { step(generator["throw"](value)); } catch (e) { reject(e); } }
        function step(result) { result.done ? resolve(result.value) : adopt(result.value).then(fulfilled, rejected); }
        step((generator = generator.apply(thisArg, _arguments || [])).next());
    });
};
var __generator = (this && this.__generator) || function (thisArg, body) {
    var _ = { label: 0, sent: function() { if (t[0] & 1) throw t[1]; return t[1]; }, trys: [], ops: [] }, f, y, t, g;
    return g = { next: verb(0), "throw": verb(1), "return": verb(2) }, typeof Symbol === "function" && (g[Symbol.iterator] = function() { return this; }), g;
    function verb(n) { return function (v) { return step([n, v]); }; }
    function step(op) {
        if (f) throw new TypeError("Generator is already executing.");
        while (_) try {
            if (f = 1, y && (t = op[0] & 2 ? y["return"] : op[0] ? y["throw"] || ((t = y["return"]) && t.call(y), 0) : y.next) && !(t = t.call(y, op[1])).done) return t;
            if (y = 0, t) op = [op[0] & 2, t.value];
            switch (op[0]) {
                case 0: case 1: t = op; break;
                case 4: _.label++; return { value: op[1], done: false };
                case 5: _.label++; y = op[1]; op = [0]; continue;
                case 7: op = _.ops.pop(); _.trys.pop(); continue;
                default:
                    if (!(t = _.trys, t = t.length > 0 && t[t.length - 1]) && (op[0] === 6 || op[0] === 2)) { _ = 0; continue; }
                    if (op[0] === 3 && (!t || (op[1] > t[0] && op[1] < t[3]))) { _.label = op[1]; break; }
                    if (op[0] === 6 && _.label < t[1]) { _.label = t[1]; t = op; break; }
                    if (t && _.label < t[2]) { _.label = t[2]; _.ops.push(op); break; }
                    if (t[2]) _.ops.pop();
                    _.trys.pop(); continue;
            }
            op = body.call(thisArg, _);
        } catch (e) { op = [6, e]; y = 0; } finally { f = t = 0; }
        if (op[0] & 5) throw op[1]; return { value: op[0] ? op[1] : void 0, done: true };
    }
};
import DataSourceParser from "./DataSourceParser";
import { assertDefined, isDefined } from "../../utils/Utils";
import SWEXmlStreamParser from "../../parsers/SWEXmlStreamParser.js";
var SosGetFoisParser = /** @class */ (function (_super) {
    __extends(SosGetFoisParser, _super);
    function SosGetFoisParser() {
        return _super !== null && _super.apply(this, arguments) || this;
    }
    /**
     * Extract data from the message. The message is in XML format following the OGC specification
     * @param {Object} data - the data to parse
     * @return {Object} the parsed data
     * @example
        <?xml version='1.0' encoding='UTF-8'?>
        <sos:GetFeatureOfInterestResponse xmlns:sos="http://www.opengis.net/sos/2.0"
                                          xmlns:gml="http://www.opengis.net/gml/3.2"
                                          xmlns:xlink="http://www.w3.org/1999/xlink"
                                          xmlns:ns1="http://www.opengis.net/sensorml/2.0">
            <sos:featureMember>
                <ns1:PhysicalSystem gml:id="FE12">
                    <gml:description>Vehicle FE12 from Huntsville Fire Department</gml:description>
                    <gml:identifier codeSpace="uid">urn:core:sensor:avl:911:fleet:FE12</gml:identifier>
                    <gml:name>FE12</gml:name>
                </ns1:PhysicalSystem>
            </sos:featureMember>
            <sos:featureMember>
                <ns1:PhysicalSystem gml:id="FE4">
                    <gml:description>Vehicle FE4 from Huntsville Fire Department</gml:description>
                    <gml:identifier codeSpace="uid">urn:core:sensor:avl:911:fleet:FE4</gml:identifier>
                    <gml:name>FE4</gml:name>
                </ns1:PhysicalSystem>
            </sos:featureMember>
        </sos:GetFeatureOfInterestResponse>
     */
    SosGetFoisParser.prototype.parseData = function (data) {
        return __awaiter(this, void 0, void 0, function () {
            var sweXmlParser, json;
            return __generator(this, function (_a) {
                sweXmlParser = new SWEXmlStreamParser(data);
                sweXmlParser.setXml(data);
                json = sweXmlParser.toJson();
                assertDefined(json.GetFeatureOfInterestResponse, 'json.GetFeatureOfInterestResponse does not exist');
                assertDefined(json.GetFeatureOfInterestResponse.featureMember, 'json.GetFeatureOfInterestResponse.featureMember does not exist');
                return [2 /*return*/, json.GetFeatureOfInterestResponse.featureMember];
            });
        });
    };
    /**
     * Builds the full url.
     * @protected
     * @param {Object} properties
     * @param {String} properties.protocol the protocol protocol
     * @param {String} properties.endpointUrl the endpoint url
     * @param {String} properties.service the service
     * @param {String} properties.procedureId the foi procedure id
     * @param {String} [properties.responseFormat=application/xml] the response format (e.g video/mp4)
     * @return {String} the full url
     */
    SosGetFoisParser.prototype.buildUrl = function (properties) {
        var url = _super.prototype.buildUrl.call(this, __assign({ responseFormat: 'application/xml' }, properties));
        // adds request
        url += "&request=GetFeatureOfInterest";
        // adds foiURN if any
        if (isDefined(properties.procedureId)) {
            url += '&procedure=' + properties.procedureId;
        }
        return url;
    };
    return SosGetFoisParser;
}(DataSourceParser));
export default SosGetFoisParser;
//# sourceMappingURL=SosGetFois.parser.js.map
