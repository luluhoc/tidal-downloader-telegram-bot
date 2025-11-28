import { XMLParser } from 'fast-xml-parser';

interface SegmentTimelineEntry {
    startTime?: number;
    duration: number;
    repeat: number;
}

interface SegmentTemplate {
    media?: string;
    initialization?: string;
    startNumber: number;
    timescale: number;
    presentationTimeOffset: number;
    timeline: SegmentTimelineEntry[];
}

interface Representation {
    id?: string;
    bandwidth?: string;
    codec?: string;
    baseUrl: string;
    segmentTemplate?: SegmentTemplate;
}

export class DashParser {
    private parser: XMLParser;

    constructor() {
        this.parser = new XMLParser({
            ignoreAttributes: false,
            attributeNamePrefix: '@_',
            isArray: (name, jpath, isLeafNode, isAttribute) => { 
                return ['Period', 'AdaptationSet', 'Representation', 'S'].indexOf(name) !== -1;
            }
        });
    }

    public parse(xml: string): string[] {
        const manifest = this.parser.parse(xml);
        const mpd = manifest.MPD;
        const mpdBaseUrl = this.getBaseUrl(mpd, '');

        const periods = mpd.Period || [];
        let audioUrls: string[] = [];

        for (const period of periods) {
            const periodBaseUrl = this.getBaseUrl(period, mpdBaseUrl);
            const adaptationSets = period.AdaptationSet || [];

            for (const adaptationSet of adaptationSets) {
                if (adaptationSet['@_contentType'] === 'audio') {
                    const adaptationSetBaseUrl = this.getBaseUrl(adaptationSet, periodBaseUrl);
                    const representations = adaptationSet.Representation || [];

                    // Find the best representation or just the first one?
                    // Python code picks the first one with segments.
                    
                    for (const rep of representations) {
                        const repBaseUrl = this.getBaseUrl(rep, adaptationSetBaseUrl);
                        const representation: Representation = {
                            id: rep['@_id'],
                            bandwidth: rep['@_bandwidth'],
                            codec: rep['@_codecs'],
                            baseUrl: repBaseUrl,
                        };

                        if (rep.SegmentTemplate) {
                            representation.segmentTemplate = this.parseSegmentTemplate(rep.SegmentTemplate);
                            const segments = this.buildSegmentTemplate(representation.segmentTemplate, representation);
                            if (segments.length > 0) {
                                return segments;
                            }
                        } else if (rep.BaseURL) {
                             // If no SegmentTemplate, maybe it's just a BaseURL (single file)
                             // But usually DASH has segments. 
                             // If it's a single file, it might not be DASH but just a direct link wrapped in XML?
                             // The Python code checks for `rep.segments`.
                             return [repBaseUrl];
                        }
                    }
                }
            }
        }
        return [];
    }

    private getBaseUrl(element: any, inherited: string): string {
        let baseUrl = inherited;
        if (element.BaseURL) {
            const text = typeof element.BaseURL === 'string' ? element.BaseURL : element.BaseURL['#text'];
            if (text) {
                // Handle relative URLs
                if (text.match(/^https?:\/\//)) {
                    baseUrl = text;
                } else {
                    // Simple join. 
                    // If inherited ends with /, just append.
                    // If not, and text doesn't start with /, append /?
                    // URL join logic can be complex.
                    if (baseUrl.endsWith('/')) {
                        baseUrl += text;
                    } else {
                        baseUrl += '/' + text;
                    }
                }
            }
        }
        return baseUrl;
    }

    private parseSegmentTemplate(element: any): SegmentTemplate {
        const template: SegmentTemplate = {
            media: element['@_media'],
            initialization: element['@_initialization'],
            startNumber: parseInt(element['@_startNumber'] || '1'),
            timescale: parseInt(element['@_timescale'] || '1'),
            presentationTimeOffset: parseInt(element['@_presentationTimeOffset'] || '0'),
            timeline: []
        };

        if (element.SegmentTimeline && element.SegmentTimeline.S) {
            for (const s of element.SegmentTimeline.S) {
                template.timeline.push({
                    startTime: s['@_t'] ? parseInt(s['@_t']) : undefined,
                    duration: parseInt(s['@_d']),
                    repeat: parseInt(s['@_r'] || '0')
                });
            }
        }

        return template;
    }

    private buildSegmentTemplate(template: SegmentTemplate, representation: Representation): string[] {
        const segments: string[] = [];

        if (template.initialization) {
            segments.push(this.completeUrl(template.initialization, representation.baseUrl, representation));
        }

        let number = template.startNumber;
        let currentTime = template.timeline.length > 0 && template.timeline[0].startTime !== undefined 
            ? template.timeline[0].startTime 
            : template.presentationTimeOffset;

        for (const entry of template.timeline) {
            if (entry.startTime !== undefined) {
                currentTime = entry.startTime;
            }

            for (let i = 0; i <= entry.repeat; i++) {
                if (template.media) {
                    segments.push(this.completeUrl(template.media, representation.baseUrl, representation, number, currentTime));
                }
                number++;
                currentTime += entry.duration;
            }
        }

        return segments;
    }

    private completeUrl(template: string, baseUrl: string, representation: Representation, number?: number, time?: number): string {
        let result = template;
        
        if (representation.id) result = result.replace(/\$RepresentationID\$/g, representation.id);
        if (representation.bandwidth) result = result.replace(/\$Bandwidth\$/g, representation.bandwidth);
        if (number !== undefined) result = result.replace(/\$Number\$/g, number.toString());
        if (time !== undefined) result = result.replace(/\$Time\$/g, time.toString());
        
        result = result.replace(/\$\$/g, '$');

        if (result.match(/^https?:\/\//)) {
            return result;
        }
        
        // Join with base URL
        if (baseUrl.endsWith('/')) {
            return baseUrl + result;
        } else {
            return baseUrl + '/' + result;
        }
    }
}
