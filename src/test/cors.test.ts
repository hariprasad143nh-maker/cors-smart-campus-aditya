import { describe, it, expect } from 'vitest';
import { INITIAL_POINTS, INITIAL_CONNECTIONS, calculateFastestPath } from '@/lib/campus-data';
import { AiMultipathFilter, formatNmeaGngga, canvasToCampusLatLng } from '@/lib/cors-rtk';
import { parseVoiceCommand } from '@/lib/voice-ai';

describe('CORS-RTK & AI Smart Campus modules', () => {
  it('routes wheelchair-accessible path avoiding stair shortcuts', () => {
    // Standard route from reception -> cse_dept takes direct stair shortcut
    const normal = calculateFastestPath('reception', 'cse_dept', INITIAL_POINTS, INITIAL_CONNECTIONS);
    expect(normal).toEqual(['reception', 'cse_dept']);

    // Accessible mode avoids stairs and routes via j_central ramp walkway
    const accessible = calculateFastestPath('reception', 'cse_dept', INITIAL_POINTS, INITIAL_CONNECTIONS, {
      accessibleOnly: true,
    });
    expect(accessible).toEqual(['reception', 'j_central', 'cse_dept']);
  });

  it('AI multipath filter keeps CORS-RTK error within centimeter range (< 0.05 m)', () => {
    const filter = new AiMultipathFilter();
    for (let i = 0; i < 20; i++) {
      const sample = filter.processPoint(400 + i * 5, 380 - i * 4, 'high', 'compare');
      expect(sample.corsAiErrorM).toBeLessThan(0.05);
      expect(sample.rawGpsErrorM).toBeGreaterThan(1.0);
      expect(sample.nmeaGga).toMatch(/^\$GNGGA,.*,4,.*\*[0-9A-F]{2}$/);
    }
  });

  it('generates valid NMEA-0183 GNGGA checksum for RTK Fixed (4) and Autonomous GPS (1)', () => {
    const ll = canvasToCampusLatLng(400, 380);
    const rtkSentence = formatNmeaGngga(ll.lat, ll.lng, 'CORS_RTK_FIXED', 32, 0.62, 0.8);
    const gpsSentence = formatNmeaGngga(ll.lat, ll.lng, 'STANDALONE_GPS', 9, 2.8, 0);

    expect(rtkSentence.startsWith('$GNGGA,')).toBe(true);
    expect(rtkSentence).toContain(',4,32,0.62,');
    expect(gpsSentence).toContain(',1,09,2.80,');

    // Verify XOR checksum integrity
    const [body, hex] = rtkSentence.slice(1).split('*');
    let xor = 0;
    for (let i = 0; i < body.length; i++) xor ^= body.charCodeAt(i);
    expect(xor.toString(16).toUpperCase().padStart(2, '0')).toBe(hex);
  });

  it('parses multilingual voice commands and wheelchair accessibility intent', () => {
    const nodes = Object.keys(INITIAL_POINTS).filter((n) => !n.startsWith('j_'));

    const enCmd = parseVoiceCommand('Take me to CSE department using a wheelchair ramp', nodes);
    expect(enCmd.destinationNode).toBe('cse_dept');
    expect(enCmd.accessibleMode).toBe(true);

    const teCmd = parseVoiceCommand('లైబ్రరీ కి వెళ్ళాలి వీల్ చైర్ మార్గం', nodes);
    expect(teCmd.destinationNode).toBe('library');
    expect(teCmd.accessibleMode).toBe(true);

    const hiCmd = parseVoiceCommand('कैंटीन जाना है', nodes);
    expect(hiCmd.destinationNode).toBe('canteen');
    expect(hiCmd.accessibleMode).toBe(false);
  });
});
