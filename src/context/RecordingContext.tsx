import React, { createContext, useContext, useState, useRef, useEffect, ReactNode } from 'react';
import { AppContext } from './AppContext';

interface AudioMarker {
    id: string;
    time: number; // ms
}

interface RecordingContextType {
    isRecording: boolean;
    recordingTime: number; // ms

    // Actions
    startRecording: (taskId?: string) => Promise<void>;
    stopRecording: () => void;
    cancelRecording: () => void;
    addMarker: () => AudioMarker | null;

    // State
    recordingTaskId: string | null;
    audioMarkers: AudioMarker[];
    currentRecordingId: string | null; // Unique ID for the current recording session

    // Audio Visualizer Data
    analyser: AnalyserNode | null;
    audioContext: AudioContext | null; // Exposed for visualization if needed
}

export const RecordingContext = createContext<RecordingContextType>({
    isRecording: false,
    recordingTime: 0,
    startRecording: async () => { },
    stopRecording: () => { },
    cancelRecording: () => { },
    addMarker: () => null,
    recordingTaskId: null,
    audioMarkers: [],
    currentRecordingId: null,
    analyser: null,
    audioContext: null,
});

export const RecordingProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
    // Basic setup, no unused imports
    useContext(AppContext); // consumed for potential updates if needed, but not forcing unused vars

    const [isRecording, setIsRecording] = useState(false);
    const [recordingTime, setRecordingTime] = useState(0);
    const [recordingTaskId, setRecordingTaskId] = useState<string | null>(null);
    const [audioMarkers, setAudioMarkers] = useState<AudioMarker[]>([]);
    const [currentRecordingId, setCurrentRecordingId] = useState<string | null>(null);

    const mediaRecorderRef = useRef<MediaRecorder | null>(null);
    const audioContextRef = useRef<AudioContext | null>(null);
    const analyserRef = useRef<AnalyserNode | null>(null);
    const sourceRef = useRef<MediaStreamAudioSourceNode | null>(null);
    const streamRef = useRef<MediaStream | null>(null);
    const chunksRef = useRef<Blob[]>([]);
    const timerRef = useRef<NodeJS.Timeout | null>(null);
    const recordingStartTimeRef = useRef<number>(0); // Store the actual start time for accurate elapsed calculation

    // Refs for closure access
    const isRecordingRef = useRef(isRecording);
    const recordingTimeRef = useRef(recordingTime);
    const recordingTaskIdRef = useRef(recordingTaskId);
    const audioMarkersRef = useRef(audioMarkers);

    useEffect(() => {
        isRecordingRef.current = isRecording;
        recordingTimeRef.current = recordingTime;
        recordingTaskIdRef.current = recordingTaskId;
        audioMarkersRef.current = audioMarkers;
    }, [isRecording, recordingTime, recordingTaskId, audioMarkers]);

    const startRecording = async (taskId?: string) => {
        // Prevent starting a new recording if one is already in progress
        if (isRecording) {
            console.warn('[RecordingContext] Cannot start recording - another recording is already in progress for task:', recordingTaskId);
            return;
        }

        try {
            const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
            streamRef.current = stream;

            // Setup Audio Context for Visualization
            const audioCtx = new (window.AudioContext || (window as any).webkitAudioContext)();
            audioContextRef.current = audioCtx;
            const analyser = audioCtx.createAnalyser();
            analyser.fftSize = 2048;
            analyserRef.current = analyser;

            const source = audioCtx.createMediaStreamSource(stream);
            source.connect(analyser);
            sourceRef.current = source;

            // Setup Recorder
            const mimeType = MediaRecorder.isTypeSupported('audio/mp4') ? 'audio/mp4' : 'audio/webm';
            const recorder = new MediaRecorder(stream, {
                mimeType,
                audioBitsPerSecond: 32000
            });

            mediaRecorderRef.current = recorder;
            chunksRef.current = [];

            // Generate unique ID for this recording session
            const recordingId = `rec_${Date.now()}_${crypto.randomUUID()}`;
            setCurrentRecordingId(recordingId);

            recorder.ondataavailable = (e) => {
                if (e.data.size > 0) chunksRef.current.push(e.data);
            };

            recorder.onstop = async () => {
                const blob = new Blob(chunksRef.current, { type: mimeType });
                const ext = mimeType.split('/')[1];

                // Filename
                const now = new Date();
                const dateStr = `${now.getFullYear()}.${String(now.getMonth() + 1).padStart(2, '0')}.${String(now.getDate()).padStart(2, '0')} ${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}`;

                // If we know the task, prefix with task name? Or just generic.
                const fileName = `Recording ${dateStr}.${ext}`;
                const file = new File([blob], fileName, { type: mimeType });

                // Cleanup Tracks
                if (streamRef.current) {
                    streamRef.current.getTracks().forEach(track => track.stop());
                }
                if (audioContextRef.current && audioContextRef.current.state !== 'closed') {
                    audioContextRef.current.close();
                }

                // SAVE LOGIC
                // We need to upload this file and attach it to the task
                const targetTaskId = recordingTaskIdRef.current;
                const finalMarkers = audioMarkersRef.current;

                if (targetTaskId) {
                    console.log(`[RecordingContext] Saving recording for Task ${targetTaskId}`, file, finalMarkers);

                    // 1. Upload File (Mocking upload for now, or using AppContext if available)
                    // Since AppContext usually exposes state setters, we might need a way to upload.
                    // Assuming AppContext might not have a direct "uploadFile" function exposed easily without component context.
                    // However, we can use the `updateTask` to verify data.
                    // Ideally, we should upload to Supabase here.

                    // For now, we simulate the "save" by dispatching a custom event or using a callback if we had one.
                    // But wait, we have `updateTask` from useContext!

                    // We need to create an attachment object.
                    // In a real app, we upload to Storage -> get URL -> update Task.
                    // Here, we might need to rely on the existing logic in TaskInput? 
                    // Or duplicates.

                    // Let's attempt to use the `onSaveAudio` logic path.
                    // Since we can't easily upload here without the Supabase client (unless we import it).
                    // Let's import supabase client directly if possible.
                    // Check imports...

                    // For now, let's create a specialized Global Event or use window dispatch to let the main app handle the upload?
                    // No, that's messy.

                    // Simplest approach: Use `updateTask` to store the raw Blob URL for local usage?
                    // No, blobs expire.

                    // Let's try to assume there is a global handler or just do the upload here if we can.

                    // Let's implement a quick upload helper or dispatch an event that `App.tsx` or `TaskInput` listens to?
                    // But TaskInput might be unmounted.

                    // Let's Dispatch a Global Event "AUDIO_RECORDING_COMPLETED" with the file and task ID.
                    // The App root can listen to this and perform the upload/save.

                    window.dispatchEvent(new CustomEvent('audio-recording-completed', {
                        detail: {
                            file,
                            taskId: targetTaskId,
                            markers: finalMarkers,
                            duration: recordingTimeRef.current,
                            recordingId // Include the unique recording ID
                        }
                    }));
                } else {
                    console.warn("Recording stopped but no Task ID associated.");
                }

                setIsRecording(false);
                setRecordingTaskId(null);
                setAudioMarkers([]);
                setRecordingTime(0);
                setCurrentRecordingId(null);
            };

            recorder.start(100);
            setIsRecording(true);
            setRecordingTaskId(taskId || null);
            setRecordingTime(0);
            setAudioMarkers([]);

            // Store the actual start time for accurate elapsed time calculation
            recordingStartTimeRef.current = Date.now();

            // Use Date.now() to calculate actual elapsed time instead of accumulating fixed intervals
            // This prevents timestamp drift that occurs when setInterval is delayed by the event loop
            timerRef.current = setInterval(() => {
                const elapsed = Date.now() - recordingStartTimeRef.current;
                setRecordingTime(elapsed);
            }, 100);

        } catch (err) {
            console.error("[RecordingContext] Failed to start recording", err);
        }
    };

    const stopRecording = () => {
        if (mediaRecorderRef.current && mediaRecorderRef.current.state !== 'inactive') {
            mediaRecorderRef.current.stop();
        }
        if (timerRef.current) {
            clearInterval(timerRef.current);
            timerRef.current = null;
        }
        // State cleanup happens in onstop
    };

    const cancelRecording = () => {
        if (mediaRecorderRef.current && mediaRecorderRef.current.state !== 'inactive') {
            // Stop but don't save?
            // Just nullify the onstop or ignore data
            mediaRecorderRef.current.onstop = null;
            mediaRecorderRef.current.stop();
        }
        if (timerRef.current) {
            clearInterval(timerRef.current);
            timerRef.current = null;
        }

        // Cleanup streams
        if (streamRef.current) {
            streamRef.current.getTracks().forEach(track => track.stop());
        }
        if (audioContextRef.current && audioContextRef.current.state !== 'closed') {
            audioContextRef.current.close();
        }

        setIsRecording(false);
        setRecordingTaskId(null);
        setAudioMarkers([]);
        setRecordingTime(0);
    };

    const addMarker = () => {
        if (!isRecording) return null;

        const time = recordingTime;
        const id = `rec-marker-${Date.now()}`;

        const newMarker = { id, time };
        setAudioMarkers(prev => [...prev, newMarker]);

        // Return marker so consumer can insert it into text editor immediately
        return newMarker;
    };

    return (
        <RecordingContext.Provider value={{
            isRecording,
            recordingTime,
            startRecording,
            stopRecording,
            cancelRecording,
            addMarker,
            recordingTaskId,
            audioMarkers,
            currentRecordingId,
            analyser: analyserRef.current,
            audioContext: audioContextRef.current
        }}>
            {children}
        </RecordingContext.Provider>
    );
};
