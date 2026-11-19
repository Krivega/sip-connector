const keepSingleH264VideoInSdp = (sdp: string): string => {
  const lineEnding = sdp.includes('\r\n') ? '\r\n' : '\n';

  return sdp
    .split(/(?=^m=)/m)
    .map((section) => {
      if (!section.startsWith('m=video ')) {
        return section;
      }

      const [mediaLine, ...attributes] = section.split(lineEnding);
      const [media, port, protocol, ...payloadTypes] = mediaLine.split(' ');
      const h264PayloadTypes = new Set(
        Array.from(section.matchAll(/^a=rtpmap:(\d+) H264\/90000$/gim), ([, payloadType]) => {
          return payloadType;
        }),
      );
      const h264PayloadType = payloadTypes.find((payloadType) => {
        const fmtp = attributes.find((line) => {
          return line.startsWith(`a=fmtp:${payloadType} `);
        });

        return (
          h264PayloadTypes.has(payloadType) &&
          /(?:\s|;)packetization-mode=1(?:;|\s|$)/.test(fmtp ?? '')
        );
      });

      if (h264PayloadType === undefined) {
        return section;
      }

      const allowedPayloadTypes = new Set([h264PayloadType]);

      for (const [, rtxPayloadType] of section.matchAll(/^a=rtpmap:(\d+) rtx\/90000$/gim)) {
        const fmtp = attributes.find((line) => {
          return line.startsWith(`a=fmtp:${rtxPayloadType} `);
        });
        const apt = fmtp?.match(/(?:\s|;)apt=(\d+)(?:;|\s|$)/)?.[1];

        if (apt === h264PayloadType && payloadTypes.includes(rtxPayloadType)) {
          allowedPayloadTypes.add(rtxPayloadType);
        }
      }

      const videoPayloadTypes = payloadTypes.filter((payloadType) => {
        return allowedPayloadTypes.has(payloadType);
      });
      const videoAttributes = attributes.filter((line) => {
        const payloadType = /^a=(?:rtpmap|fmtp|rtcp-fb):(\d+)(?:\s|$)/.exec(line)?.[1];

        return payloadType === undefined || allowedPayloadTypes.has(payloadType);
      });

      return [[media, port, protocol, ...videoPayloadTypes].join(' '), ...videoAttributes].join(
        lineEnding,
      );
    })
    .join('');
};

export default keepSingleH264VideoInSdp;
