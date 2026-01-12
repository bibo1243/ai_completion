import { useState, useContext, useMemo } from 'react';
import { BookOpen, ChevronLeft, ChevronRight, Copy, Check, Plus, X, Edit2, Save, Trash2 } from 'lucide-react';
import { AppContext } from '../context/AppContext';

interface WorkLogEntry {
    id: string;
    date: string; // YYYY-MM-DD
    content: string;
    created_at: string;
    updated_at: string;
}

export const WorkLogView = () => {
    const { user, setToast } = useContext(AppContext);

    // Local state for work logs (will be synced to Firebase later)
    const [workLogs, setWorkLogs] = useState<WorkLogEntry[]>(() => {
        const saved = localStorage.getItem(`work_logs_${user?.id}`);
        return saved ? JSON.parse(saved) : [];
    });

    const [selectedDate, setSelectedDate] = useState<string>(() => {
        return new Date().toISOString().split('T')[0];
    });

    const [isEditing, setIsEditing] = useState(false);
    const [editContent, setEditContent] = useState('');
    const [copied, setCopied] = useState(false);

    // Save to localStorage whenever workLogs changes
    const saveToStorage = (logs: WorkLogEntry[]) => {
        localStorage.setItem(`work_logs_${user?.id}`, JSON.stringify(logs));
        setWorkLogs(logs);
    };

    // Get today's log
    const currentLog = useMemo(() => {
        return workLogs.find(log => log.date === selectedDate);
    }, [workLogs, selectedDate]);

    // Navigate dates
    const goToPrevDay = () => {
        const date = new Date(selectedDate);
        date.setDate(date.getDate() - 1);
        setSelectedDate(date.toISOString().split('T')[0]);
    };

    const goToNextDay = () => {
        const date = new Date(selectedDate);
        date.setDate(date.getDate() + 1);
        setSelectedDate(date.toISOString().split('T')[0]);
    };

    const goToToday = () => {
        setSelectedDate(new Date().toISOString().split('T')[0]);
    };

    // Format date for display
    const formatDate = (dateStr: string) => {
        const date = new Date(dateStr);
        const weekdays = ['日', '一', '二', '三', '四', '五', '六'];
        const year = date.getFullYear();
        const month = date.getMonth() + 1;
        const day = date.getDate();
        const weekday = weekdays[date.getDay()];
        return `${year}年${month}月${day}日（${weekday}）`;
    };

    // Generate default template
    const generateTemplate = () => {
        const dateFormatted = formatDate(selectedDate);
        return `## ${dateFormatted}

### 一、今日工作重點

#### （一）[專案/任務名稱]
1. [工作內容描述]
2. [工作內容描述]

#### （二）[專案/任務名稱]
1. [工作內容描述]
2. [工作內容描述]

### 二、待辦事項

| 優先序 | 事項 | 期限 | 狀態 |
|-------|------|------|------|
| 1 | [待辦事項] | [日期] | 待處理 |
| 2 | [待辦事項] | [日期] | 待處理 |

### 三、備註
- [其他需要說明的事項]
`;
    };

    // Create new log
    const handleCreate = () => {
        const template = generateTemplate();
        const newLog: WorkLogEntry = {
            id: crypto.randomUUID(),
            date: selectedDate,
            content: template,
            created_at: new Date().toISOString(),
            updated_at: new Date().toISOString(),
        };
        saveToStorage([...workLogs, newLog]);
        setEditContent(template);
        setIsEditing(true);
    };

    // Start editing
    const handleEdit = () => {
        setEditContent(currentLog?.content || '');
        setIsEditing(true);
    };

    // Save edit
    const handleSave = () => {
        if (currentLog) {
            const updated = workLogs.map(log =>
                log.id === currentLog.id
                    ? { ...log, content: editContent, updated_at: new Date().toISOString() }
                    : log
            );
            saveToStorage(updated);
        }
        setIsEditing(false);
        setToast?.({ msg: '日誌已儲存', type: 'info' });
    };

    // Delete log
    const handleDelete = () => {
        if (currentLog && confirm('確定要刪除這篇日誌嗎？')) {
            const filtered = workLogs.filter(log => log.id !== currentLog.id);
            saveToStorage(filtered);
            setIsEditing(false);
            setToast?.({ msg: '日誌已刪除', type: 'info' });
        }
    };

    // Copy to clipboard (Word-friendly format)
    const handleCopy = async () => {
        const content = currentLog?.content || '';
        // Convert markdown to plain text with proper formatting
        const plainText = content
            .replace(/^## /gm, '')
            .replace(/^### /gm, '')
            .replace(/^#### /gm, '')
            .replace(/\*\*/g, '')
            .replace(/\|/g, '\t')
            .replace(/-{3,}/g, '');

        try {
            await navigator.clipboard.writeText(plainText);
            setCopied(true);
            setTimeout(() => setCopied(false), 2000);
            setToast?.({ msg: '已複製到剪貼簿', type: 'info' });
        } catch (err) {
            setToast?.({ msg: '複製失敗', type: 'error' });
        }
    };

    // Render markdown content
    const renderContent = (content: string) => {
        return content.split('\n').map((line, i) => {
            if (line.startsWith('## ')) {
                return <h2 key={i} className="text-xl font-bold text-gray-800 mb-4 mt-6 first:mt-0">{line.slice(3)}</h2>;
            }
            if (line.startsWith('### ')) {
                return <h3 key={i} className="text-lg font-bold text-gray-700 mb-3 mt-5">{line.slice(4)}</h3>;
            }
            if (line.startsWith('#### ')) {
                return <h4 key={i} className="text-base font-semibold text-gray-600 mb-2 mt-4">{line.slice(5)}</h4>;
            }
            if (line.startsWith('| ')) {
                const cells = line.split('|').filter(c => c.trim());
                const isHeader = line.includes('---');
                if (isHeader) return null;
                return (
                    <div key={i} className="grid grid-cols-4 gap-2 px-2 py-1 text-sm border-b border-gray-100">
                        {cells.map((cell, j) => (
                            <span key={j} className={j === 0 ? 'font-medium' : 'text-gray-600'}>{cell.trim()}</span>
                        ))}
                    </div>
                );
            }
            if (line.match(/^\d+\. /)) {
                return <p key={i} className="text-sm text-gray-700 ml-6 mb-1">{line}</p>;
            }
            if (line.startsWith('- ')) {
                return <p key={i} className="text-sm text-gray-700 ml-4 mb-1">• {line.slice(2)}</p>;
            }
            if (line.trim() === '') {
                return <div key={i} className="h-2" />;
            }
            return <p key={i} className="text-sm text-gray-700 mb-1">{line}</p>;
        });
    };

    const isToday = selectedDate === new Date().toISOString().split('T')[0];

    return (
        <div className="h-full flex flex-col bg-white overflow-hidden">
            {/* Header */}
            <div className="p-4 border-b border-gray-100 flex justify-between items-center bg-white z-10">
                <div className="flex items-center gap-4">
                    <h2 className="font-bold text-gray-700 flex items-center gap-2">
                        <BookOpen size={18} />
                        工作日誌
                    </h2>
                </div>

                {/* Date Navigation */}
                <div className="flex items-center gap-2">
                    <button
                        onClick={goToPrevDay}
                        className="p-1.5 rounded hover:bg-gray-100 text-gray-500"
                    >
                        <ChevronLeft size={18} />
                    </button>
                    <span className="font-medium text-gray-700 min-w-[180px] text-center">
                        {formatDate(selectedDate)}
                    </span>
                    <button
                        onClick={goToNextDay}
                        className="p-1.5 rounded hover:bg-gray-100 text-gray-500"
                    >
                        <ChevronRight size={18} />
                    </button>
                    {!isToday && (
                        <button
                            onClick={goToToday}
                            className="ml-2 px-2 py-1 text-xs bg-indigo-50 text-indigo-600 rounded hover:bg-indigo-100"
                        >
                            今天
                        </button>
                    )}
                </div>

                {/* Actions */}
                <div className="flex items-center gap-2">
                    {currentLog && !isEditing && (
                        <>
                            <button
                                onClick={handleCopy}
                                className="flex items-center gap-1 px-3 py-1.5 bg-gray-100 text-gray-700 rounded-lg hover:bg-gray-200 text-sm font-medium transition-colors"
                            >
                                {copied ? <Check size={14} /> : <Copy size={14} />}
                                {copied ? '已複製' : '複製'}
                            </button>
                            <button
                                onClick={handleEdit}
                                className="flex items-center gap-1 px-3 py-1.5 bg-indigo-100 text-indigo-700 rounded-lg hover:bg-indigo-200 text-sm font-medium transition-colors"
                            >
                                <Edit2 size={14} />
                                編輯
                            </button>
                            <button
                                onClick={handleDelete}
                                className="flex items-center gap-1 px-3 py-1.5 bg-red-50 text-red-600 rounded-lg hover:bg-red-100 text-sm font-medium transition-colors"
                            >
                                <Trash2 size={14} />
                            </button>
                        </>
                    )}
                    {isEditing && (
                        <>
                            <button
                                onClick={() => setIsEditing(false)}
                                className="flex items-center gap-1 px-3 py-1.5 bg-gray-100 text-gray-700 rounded-lg hover:bg-gray-200 text-sm font-medium transition-colors"
                            >
                                <X size={14} />
                                取消
                            </button>
                            <button
                                onClick={handleSave}
                                className="flex items-center gap-1 px-3 py-1.5 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 text-sm font-medium transition-colors"
                            >
                                <Save size={14} />
                                儲存
                            </button>
                        </>
                    )}
                    {!currentLog && !isEditing && (
                        <button
                            onClick={handleCreate}
                            className="flex items-center gap-1 px-3 py-1.5 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 text-sm font-medium transition-colors shadow-sm"
                        >
                            <Plus size={16} />
                            建立日誌
                        </button>
                    )}
                </div>
            </div>

            {/* Content */}
            <div className="flex-1 overflow-y-auto p-6 bg-gray-50/50">
                {isEditing ? (
                    <div className="max-w-3xl mx-auto">
                        <textarea
                            value={editContent}
                            onChange={(e) => setEditContent(e.target.value)}
                            className="w-full h-[calc(100vh-200px)] p-4 bg-white rounded-xl border border-gray-200 focus:ring-2 focus:ring-indigo-100 focus:border-indigo-300 outline-none font-mono text-sm resize-none"
                            placeholder="輸入日誌內容..."
                        />
                    </div>
                ) : currentLog ? (
                    <div className="max-w-3xl mx-auto bg-white rounded-xl shadow-sm border border-gray-100 p-6">
                        {renderContent(currentLog.content)}
                    </div>
                ) : (
                    <div className="flex flex-col items-center justify-center h-full text-gray-400">
                        <BookOpen size={48} className="mb-4 opacity-20" />
                        <p className="text-sm">這天沒有日誌紀錄</p>
                        <button
                            onClick={handleCreate}
                            className="mt-4 flex items-center gap-1 px-4 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 text-sm font-medium transition-colors"
                        >
                            <Plus size={16} />
                            建立日誌
                        </button>
                    </div>
                )}
            </div>
        </div>
    );
};
