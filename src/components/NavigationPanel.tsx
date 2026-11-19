import { useMemo, useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Navigation, Volume2, VolumeX, Search, Mic, MicOff, Loader2 } from 'lucide-react';
import { useI18n } from '@/lib/i18n';
import { isSpeechRecognitionSupported, listenForVoiceCommand } from '@/lib/voice-ai';

interface NavigationPanelProps {
  visibleNodes: string[];
  startNode: string;
  destNode: string;
  onStartChange: (v: string) => void;
  onDestChange: (v: string) => void;
  onNavigate: () => void;
  onVoiceCommand?: (destNode: string, accessible: boolean, transcript: string) => void;
  isNavigating: boolean;
  speechEnabled: boolean;
  onToggleSpeech: () => void;
}

export function NavigationPanel({
  visibleNodes, startNode, destNode, onStartChange, onDestChange,
  onNavigate, onVoiceCommand, isNavigating, speechEnabled, onToggleSpeech
}: NavigationPanelProps) {
  const { t, lang } = useI18n();
  const formatName = (n: string) => n.replace(/_/g, ' ').replace(/\b\w/g, c => c.toUpperCase());
  const [search, setSearch] = useState('');
  const [listening, setListening] = useState(false);
  const [voiceFeedback, setVoiceFeedback] = useState('');
  const voiceSupported = isSpeechRecognitionSupported();
  const searchLower = search.trim().toLowerCase();
  const filteredNodes = useMemo(() => {
    if (!searchLower) return visibleNodes;
    return visibleNodes.filter(n => formatName(n).toLowerCase().includes(searchLower));
  }, [visibleNodes, searchLower]);

  const handleVoiceClick = async () => {
    if (!voiceSupported || listening) return;
    setListening(true);
    setVoiceFeedback('Listening… Say e.g. "CSE Dept wheelchair ramp"');
    try {
      const result = await listenForVoiceCommand(lang, visibleNodes);
      if (result.destinationNode) {
        setVoiceFeedback(`Heard "${result.transcript}" → ${result.matchedLabel}${result.accessibleMode ? ' (Ramp Mode)' : ''}`);
        onDestChange(result.destinationNode);
        onVoiceCommand?.(result.destinationNode, result.accessibleMode, result.transcript);
      } else {
        setVoiceFeedback(`Heard "${result.transcript}" — no matching campus landmark found.`);
      }
    } catch (err: any) {
      setVoiceFeedback(err?.message || 'Could not capture voice command.');
    } finally {
      setListening(false);
      setTimeout(() => setVoiceFeedback(''), 6000);
    }
  };

  return (
    <div className="p-4 pb-6 space-y-3 sm:p-3">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Navigation className="w-5 h-5 text-primary" />
          <h3 className="text-base font-semibold text-foreground">{t('nav.title')}</h3>
        </div>
        <div className="flex items-center gap-1">
          <Button
            variant={listening ? 'destructive' : 'outline'}
            size="sm"
            onClick={handleVoiceClick}
            disabled={!voiceSupported}
            className="h-9 px-2.5 text-xs gap-1"
            title={voiceSupported ? 'Voice AI destination search (EN/TE/HI)' : 'Voice input requires Chrome or Edge'}
            aria-label="Voice AI command"
          >
            {listening ? <Loader2 className="w-4 h-4 animate-spin" /> : voiceSupported ? <Mic className="w-4 h-4 text-primary" /> : <MicOff className="w-4 h-4" />}
            <span>{listening ? 'Listening' : 'Voice AI'}</span>
          </Button>
          <Button variant="ghost" size="sm" onClick={onToggleSpeech} className="h-9 w-9 p-0" aria-label="Toggle voice">
            {speechEnabled ? <Volume2 className="w-5 h-5" /> : <VolumeX className="w-5 h-5" />}
          </Button>
        </div>
      </div>

      {voiceFeedback && (
        <div className="rounded-md bg-primary/10 border border-primary/25 px-2.5 py-1.5 text-[11px] text-foreground">
          🎙️ {voiceFeedback}
        </div>
      )}

      <div className="relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground pointer-events-none" />
        <Input
          value={search}
          onChange={e => setSearch(e.target.value)}
          placeholder={t('nav.search') || 'Search location'}
          className="pl-9 h-11 text-base"
          aria-label="Search locations"
        />
      </div>

      <Select value={startNode} onValueChange={onStartChange}>
        <SelectTrigger className="h-12 text-base sm:h-11 sm:text-sm">
          <SelectValue placeholder={t('nav.start')} />
        </SelectTrigger>
        <SelectContent>
          {/* Junctions stay hidden from the list, but a GPS-assigned junction must still display. */}
          {startNode.startsWith('j_') && (
            <SelectItem value={startNode}>Nearest walkway point (GPS)</SelectItem>
          )}
          {filteredNodes.map(n => (
            <SelectItem key={n} value={n}>{formatName(n)}</SelectItem>
          ))}
          {filteredNodes.length === 0 && (
            <div className="px-3 py-2 text-sm text-muted-foreground">No locations found</div>
          )}
        </SelectContent>
      </Select>

      <Select value={destNode} onValueChange={onDestChange}>
        <SelectTrigger className="h-12 text-base sm:h-11 sm:text-sm">
          <SelectValue placeholder={t('nav.destination')} />
        </SelectTrigger>
        <SelectContent>
          {filteredNodes.map(n => (
            <SelectItem key={n} value={n}>{formatName(n)}</SelectItem>
          ))}
          {filteredNodes.length === 0 && (
            <div className="px-3 py-2 text-sm text-muted-foreground">No locations found</div>
          )}
        </SelectContent>
      </Select>

      <Button
        className="w-full h-12 text-base"
        onClick={onNavigate}
        disabled={!startNode || !destNode || startNode === destNode}
      >
        <Navigation className="w-4 h-4 mr-2" />
        {isNavigating ? t('nav.replaceRoute') : t('nav.startNav')}
      </Button>
    </div>
  );
}
