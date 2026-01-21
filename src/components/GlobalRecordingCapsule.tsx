import { useContext, useEffect, useRef, useState } from 'react';
import { RecordingContext } from '../context/RecordingContext';
import { AppContext } from '../context/AppContext';
import { Square, ChevronDown, Mic, Radio, LocateFixed } from 'lucide-react';

export const GlobalRecordingCapsule = () => {
    const { isRecording, recordingTime, stopRecording, analyser, recordingTaskId } = useContext(RecordingContext);
    const { setFocusedTaskId, tasks, setView, setExpandedTaskIds, setEditingTaskId } = useContext(AppContext);
    const [isMinimized, setIsMinimized] = useState(false);
    const canvasRef = useRef<HTMLCanvasElement>(null);
    const animationFrameRef = useRef<number>();

    const locateTask = () => {
        if (!recordingTaskId) return;

        // 1. Switch View to ensure task is reachable
        setView('allview'); // Using allview is safest to find any task

        // 2. Expand Path to Task
        const task = tasks.find(t => t.id === recordingTaskId);
        if (task) {
            let curr = task;
            const parentsToExpand: string[] = [];
            while (curr.parent_id) {
                parentsToExpand.push(curr.parent_id);
                const p = tasks.find(x => x.id === curr.parent_id);
                if (!p) break;
                curr = p;
            }
            if (parentsToExpand.length > 0) {
                setExpandedTaskIds(prev => [...new Set([...prev, ...parentsToExpand])]);
            }
        }

        // 3. Focus and Open Editor
        setFocusedTaskId(recordingTaskId);
        setEditingTaskId(recordingTaskId); // "Expand task editing"

        // 4. Restore UI
        setIsMinimized(false);
    };


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

    if (isMinimized) {
        return (
            <div
                className="fixed bottom-6 left-6 z-[99999] animate-in fade-in zoom-in duration-300 cursor-pointer group"
                onClick={locateTask} // Click to locate and expand
                title="Recording in progress. Click to locate task."
            >
                <div className="bg-black/80 backdrop-blur-md border border-emerald-500/30 rounded-full p-2.5 shadow-2xl flex items-center justify-center relative hover:bg-black/90 transition-all hover:scale-110">
                    <div className="w-2.5 h-2.5 bg-emerald-500 rounded-full animate-pulse shadow-[0_0_10px_rgba(16,185,129,0.8)]"></div>

                    {/* Tooltip on hover */}
                    <div className="absolute left-full ml-3 bg-black/90 text-white text-[10px] px-2 py-1 rounded-md whitespace-nowrap opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none border border-white/10 shadow-xl font-mono">
                        {formatTime(recordingTime)}
                    </div>
                </div>
            </div>
        );
    }

    return (
        <div className="fixed bottom-6 left-1/2 transform -translate-x-1/2 z-[99999] animate-in fade-in slide-in-from-bottom-4 duration-300" data-recording-capsule>
            <div className="bg-black/90 backdrop-blur-xl text-white rounded-full flex items-center p-2 pl-4 pr-3 shadow-2xl border border-white/10 gap-3 min-w-[200px] hover:scale-[1.01] transition-transform">
                <button
                    onClick={(e) => {
                        e.stopPropagation();
                        e.preventDefault();
                        stopRecording();
                    }}
                    className="w-8 h-8 rounded-full bg-red-500/20 text-red-400 flex items-center justify-center hover:bg-red-500 hover:text-white transition-all cursor-pointer"
                    title="Stop Recording"
                >
                    <Square size={12} fill="currentColor" />
                </button>

                <div className="flex flex-col items-center min-w-[50px] cursor-pointer hover:opacity-80 transition-opacity" onClick={locateTask} title="Click to locate task">
                    <span className="font-mono text-sm font-medium tabular-nums tracking-wider text-white">
                        {formatTime(recordingTime)}
                    </span>
                </div>

                {/* Mini Visualizer */}
                <div className="w-20 h-8 relative opacity-80 flex items-center cursor-pointer" onClick={locateTask} title="Click to locate task">
                    <canvas
                        ref={canvasRef}
                        width={80}
                        height={32}
                        className="w-full h-full"
                    />
                </div>

                <div className="h-6 w-[1px] bg-white/10 mx-1"></div>

                <div className="flex items-center gap-1">
                    <button
                        onClick={locateTask}
                        className="p-1.5 text-gray-400 hover:text-white hover:bg-white/10 rounded-full transition-colors"
                        title="Locate Recording Task"
                    >
                        <LocateFixed size={14} />
                    </button>
                    <button
                        onClick={() => setIsMinimized(true)}
                        className="p-1.5 text-gray-400 hover:text-white hover:bg-white/10 rounded-full transition-colors"
                        title="Minimize"
                    >
                        <ChevronDown size={16} />
                    </button>
                </div>
            </div>
        </div>
    );
};
