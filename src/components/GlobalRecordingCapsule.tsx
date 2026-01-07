import React, { useContext, useEffect, useRef } from 'react';
import { RecordingContext } from '../context/RecordingContext';
import { Square } from 'lucide-react';

export const GlobalRecordingCapsule = () => {
    const { isRecording, recordingTime, stopRecording, analyser } = useContext(RecordingContext);
    const canvasRef = useRef<HTMLCanvasElement>(null);
    const animationFrameRef = useRef<number>();

    // Visualization logic
    useEffect(() => {
        // Only run if recording AND we have an analyser
        if (!isRecording || !analyser || !canvasRef.current) return;

        const canvas = canvasRef.current;
        const ctx = canvas.getContext('2d');
        if (!ctx) return;

        const bufferLength = analyser.frequencyBinCount;
        const dataArray = new Uint8Array(bufferLength);

        const draw = () => {
            // Check ref explicitly in the loop to handle strict mode or rapid unmounts
            if (!analyser) return;

            animationFrameRef.current = requestAnimationFrame(draw);
            analyser.getByteTimeDomainData(dataArray);

            ctx.clearRect(0, 0, canvas.width, canvas.height);
            ctx.lineWidth = 2;
            ctx.strokeStyle = 'rgba(255, 255, 255, 0.8)';
            ctx.beginPath();

            const sliceWidth = canvas.width / bufferLength;
            let x = 0;

            for (let i = 0; i < bufferLength; i++) {
                const v = dataArray[i] / 128.0;
                const y = (v * canvas.height) / 2;

                if (i === 0) ctx.moveTo(x, y);
                else ctx.lineTo(x, y);

                x += sliceWidth;
            }
            ctx.lineTo(canvas.width, canvas.height / 2);
            ctx.stroke();
        };

        draw();

        return () => {
            if (animationFrameRef.current) cancelAnimationFrame(animationFrameRef.current);
        };
    }, [isRecording, analyser]);

    if (!isRecording) return null;

    const formatTime = (ms: number) => {
        const seconds = Math.floor(ms / 1000);
        const m = Math.floor(seconds / 60);
        const s = seconds % 60;
        return `${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`;
    };

    return (
        <div className="fixed bottom-6 left-1/2 transform -translate-x-1/2 z-[99999] animate-in fade-in slide-in-from-bottom-4 duration-300" data-recording-capsule>
            <div className="bg-black/90 backdrop-blur-xl text-white rounded-full flex items-center p-2 pl-4 pr-4 shadow-2xl border border-white/10 gap-4 min-w-[200px]">
                <button
                    onClick={(e) => {
                        e.stopPropagation();
                        e.preventDefault();
                        stopRecording();
                    }}
                    className="w-8 h-8 rounded-full bg-red-500/20 text-red-400 flex items-center justify-center hover:bg-red-500 hover:text-white transition-all cursor-pointer"
                    title="Stop Recording"
                >
                    <Square size={14} fill="currentColor" />
                </button>

                <div className="flex flex-col items-center min-w-[60px]">
                    <span className="font-mono text-sm font-medium tabular-nums tracking-wider text-white">
                        {formatTime(recordingTime)}
                    </span>
                </div>

                {/* Mini Visualizer */}
                <div className="w-24 h-8 relative opacity-80 flex items-center">
                    <canvas
                        ref={canvasRef}
                        width={96}
                        height={32}
                        className="w-full h-full"
                    />
                </div>

                <div className="w-2 h-2 rounded-full bg-red-500 animate-pulse shadow-[0_0_8px_rgba(239,68,68,0.6)]"></div>
            </div>
        </div>
    );
};
