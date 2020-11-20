# Video

VideoDataSource is a specific DataSource to parse Video data.

The class inherits directly from [DataSource](general.md).

There are specific properties for this DataSource.

## Specific properties

These properties are members of [customUrlParams](general.md#global-configuration).

<DocumentationLoad path="/guide/api/Video.html"/>

*(1) Note that in case of the video stream, it is very important to define the **responseFormat** to activate the support of these parameters.*

*(2) Note these parameters are available only from OSH server >= 1.4.0*

## Example

This example defines a custom bitrate, width and height:
```jsx
const dsProperties = {
    protocol: "ws",
    service: "SOS",
    observedProperty: "http://sensorml.com/ont/swe/property/VideoFrame",
    endpointUrl: "sensiasoft.net:8181/sensorhub/sos",
    offeringID: "urn:mysos:solo:video2",
    startTime: "2015-12-19T21:04:30Z",
    endTime: "2015-12-19T21:09:19Z",
    customUrlParams: {
        video_bitrate: 3200,
        width: 1280,
        height: 720
    },
    responseFormat: "video/H264"
};

const videoDataSource = new Video("drone-Video", dsProperties);
```

The result URL:

```http
ws://sensiasoft.net:8181/sensorhub/sos?service=SOS&version=2.0&request=GetResult&offering=urn:mysos:solo:video2&observedProperty=http://sensorml.com/ont/swe/property/VideoFrame&temporalFilter=phenomenonTime,2015-12-19T21:04:30Z/2015-12-19T21:09:19Z&replaySpeed=1&responseFormat=video/H264&video_bitrate=3200&video_width=1280&video_height=720
```

## Parser

The underlaying stream is binary.
 
The first 8 bytes is the timestamp in millis.
 
The next 4 bytes define the frame length.

The next bytes are corresponding to a full NAL unit.

**|--- 8 bytes timestamp ---|--- 4 bytes frame length ---|--- NAL UNIT ---|**

<ins>From Server</ins>:

```json
[..binary..data..]
```

<ins>After parsing</ins>:

```json
{
    timeStamp: 1450559070000,
    data: {
      frameData: [..binary..NAL_UNIT...],
      roll: 0    
    } 
}  
```


