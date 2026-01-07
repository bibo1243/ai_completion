import React, { useEffect, useRef, useState } from 'react';
import { Play, Pause, X, Volume2, RotateCcw, RotateCw } from 'lucide-react';

interface AudioPlayerProps {
    url: string;
    fileName?: string;
    autoPlay?: boolean;
    markers?: { time: number, id: string }[];
    onClose?: () => void;
    onMarkerClick?: (marker: { time: number, id: string }) => void;
    seekToTime?: number | null; // Time in ms to seek to (when changed)
}

const AudioPlayer: React.FC<AudioPlayerProps> = ({ url, fileName, autoPlay = false, markers = [], onClose, seekToTime }) => {
    const audioRef = useRef<HTMLAudioElement | null>(null);
    const [isPlaying, setIsPlaying] = useState(autoPlay);
    const [duration, setDuration] = useState(0);
    const [currentTime, setCurrentTime] = useState(0);

    useEffect(() => {
        if (autoPlay && audioRef.current) {
            audioRef.current.play().catch(console.error);
        }
    }, [url, autoPlay]);

    const togglePlay = () => {
        if (!audioRef.current) return;
        if (isPlaying) {
            audioRef.current.pause();
        } else {
            audioRef.current.play();
        }
        setIsPlaying(!isPlaying);
    };

    const handleTimeUpdate = () => {
        if (audioRef.current) {
            setCurrentTime(audioRef.current.currentTime);
        }
    };

    const handleLoadedMetadata = () => {
        if (audioRef.current) {
            setDuration(audioRef.current.duration);
        }
    };

    const handleSeek = (e: React.ChangeEvent<HTMLInputElement>) => {
        const time = parseFloat(e.target.value);
        if (audioRef.current) {
            audioRef.current.currentTime = time;
            setCurrentTime(time);
        }
    };

    const skip = (seconds: number) => {
        if (audioRef.current) {
            const newTime = Math.min(Math.max(audioRef.current.currentTime + seconds, 0), duration);
            audioRef.current.currentTime = newTime;
            setCurrentTime(newTime);
        }
    };

    const jumpToTime = (ms: number) => {
        if (audioRef.current) {
            const seconds = ms / 1000;
            audioRef.current.currentTime = seconds;
            setCurrentTime(seconds);
            audioRef.current.play().catch(console.error);
            setIsPlaying(true);
        }
    };

    // Handle external seek requests
    useEffect(() => {
        if (seekToTime !== null && seekToTime !== undefined && audioRef.current) {
            jumpToTime(seekToTime);
        }
    }, [seekToTime]);

    const formatTime = (time: number) => {
        if (isNaN(time)) return "0:00";
        const minutes = Math.floor(time / 60);
        const seconds = Math.floor(time % 60);
        return `${minutes}:${seconds.toString().padStart(2, '0')}`;
    };

    return (
        <div className="w-full bg-slate-50 border border-indigo-100 rounded-xl p-3 mb-4 animate-in fade-in slide-in-from-top-2 flex flex-col gap-2 shadow-sm sticky top-0 z-10 backdrop-blur-sm bg-slate-50/95">
            <div className="flex items-center justify-between">
                <div className="flex items-center gap-2 overflow-hidden">
                    <div className="w-8 h-8 rounded-full bg-indigo-100 flex items-center justify-center text-indigo-600 flex-shrink-0">
                        <Volume2 size={16} />
                    </div>
                    <span className="text-xs font-medium text-slate-700 truncate" title={fileName}>
                        {fileName || "Audio Recording"}
                    </span>
                    {markers.length > 0 && (
                        <span className="text-[10px] text-slate-400 bg-slate-200 px-1.5 py-0.5 rounded-full">
                            {markers.length} 標記
                        </span>
                    )}
                </div>
                {onClose && (
                    <button
                        onClick={onClose}
                        className="p-1 hover:bg-slate-200 rounded-full text-slate-400 hover:text-slate-600 transition-colors"
                    >
                        <X size={14} />
                    </button>
                )}
            </div>

            <audio
                ref={audioRef}
                src={url}
                onTimeUpdate={handleTimeUpdate}
                onLoadedMetadata={handleLoadedMetadata}
                onEnded={() => setIsPlaying(false)}
                className="hidden"
            />

            <div className="flex items-center justify-between gap-3">
                {/* Rewind */}
                <button
                    onClick={() => skip(-5)}
                    className="flex items-center gap-0.5 px-2 py-1 text-slate-500 hover:text-indigo-600 hover:bg-indigo-50 rounded-lg transition-colors text-xs"
                    title="後退 5 秒"
                >
                    <RotateCcw size={14} />
                    <span className="font-mono text-[10px]">5s</span>
                </button>

                {/* Play/Pause */}
                <button
                    onClick={togglePlay}
                    className="w-10 h-10 flex items-center justify-center bg-indigo-600 text-white rounded-full hover:bg-indigo-700 shadow-md transition-all active:scale-95"
                >
                    {isPlaying ? <Pause size={20} fill="currentColor" /> : <Play size={20} fill="currentColor" className="ml-1" />}
                </button>

                {/* Forward */}
                <button
                    onClick={() => skip(5)}
                    className="flex items-center gap-0.5 px-2 py-1 text-slate-500 hover:text-indigo-600 hover:bg-indigo-50 rounded-lg transition-colors text-xs"
                    title="快進 5 秒"
                >
                    <span className="font-mono text-[10px]">5s</span>
                    <RotateCw size={14} />
                </button>

                {/* Custom Seek Bar */}
                <div className="flex-1 flex items-center gap-2 min-w-0">
                    <span className="text-[10px] font-mono tabular-nums text-slate-500 w-8 text-right">
                        {formatTime(currentTime)}
                    </span>
                    <div className="relative flex-1 h-8 flex items-center group select-none">
                        <div className="absolute inset-0 flex items-center pointer-events-none">
                            <div className="w-full h-1 bg-slate-200 rounded-full overflow-visible relative">
                                <div
                                    className="h-full bg-indigo-500 transition-all duration-100 rounded-full"
                                    style={{ width: `${(currentTime / (duration || 1)) * 100}%` }}
                                />
                                {/* Markers removed per user request */}
                            </div>
                        </div>
                        <input
                            type="range"
                            min={0}
                            max={duration || 100}
                            value={currentTime}
                            onChange={handleSeek}
                            className="absolute inset-0 w-full opacity-0 cursor-pointer z-10"
                        />
                    </div>
                    <span className="text-[10px] font-mono tabular-nums text-slate-500 w-8">
                        {formatTime(duration)}
                    </span>
                </div>
            </div>
        </div>
    );
};

export default AudioPlayer;
