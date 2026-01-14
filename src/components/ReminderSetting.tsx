import { useState } from 'react';
import { Bell, BellOff, ChevronDown, X } from 'lucide-react';

interface ReminderSettingProps {
    value: number | null | undefined;
    onChange: (minutes: number | null) => void;
}

const PRESET_OPTIONS = [
    { label: '不提醒', value: null },
    { label: '準時', value: 0 },
    { label: '5 分鐘前', value: 5 },
    { label: '15 分鐘前', value: 15 },
    { label: '30 分鐘前', value: 30 },
    { label: '1 小時前', value: 60 },
    { label: '2 小時前', value: 120 },
    { label: '1 天前', value: 1440 },
];

export const ReminderSetting = ({ value, onChange }: ReminderSettingProps) => {
    const [showDropdown, setShowDropdown] = useState(false);
    const [customValue, setCustomValue] = useState('');
    const [customUnit, setCustomUnit] = useState<'minutes' | 'hours' | 'days'>('minutes');

    const getDisplayLabel = () => {
        if (value === null || value === undefined) return '不提醒';
        if (value === 0) return '準時';
        if (value < 60) return `${value} 分鐘前`;
        if (value < 1440) return `${value / 60} 小時前`;
        return `${value / 1440} 天前`;
    };

    const handleCustomSubmit = () => {
        const num = parseInt(customValue);
        if (isNaN(num) || num <= 0) return;

        let minutes = num;
        if (customUnit === 'hours') minutes = num * 60;
        if (customUnit === 'days') minutes = num * 1440;

        onChange(minutes);
        setShowDropdown(false);
        setCustomValue('');
    };

    const hasReminder = value !== null && value !== undefined;

    return (
        <div className="relative">
            <button
                type="button"
                onClick={() => setShowDropdown(!showDropdown)}
                className={`flex items-center gap-1.5 px-2 py-1 rounded-lg text-xs transition-colors ${hasReminder
                        ? 'bg-orange-100 text-orange-600 hover:bg-orange-200'
                        : 'bg-gray-100 text-gray-500 hover:bg-gray-200'
                    }`}
                title="設定提醒"
            >
                {hasReminder ? <Bell size={12} /> : <BellOff size={12} />}
                <span>{getDisplayLabel()}</span>
                <ChevronDown size={10} />
            </button>

            {showDropdown && (
                <>
                    {/* Backdrop */}
                    <div
                        className="fixed inset-0 z-40"
                        onClick={() => setShowDropdown(false)}
                    />

                    {/* Dropdown */}
                    <div className="absolute left-0 top-full mt-1 w-48 bg-white rounded-lg shadow-xl border border-gray-200 z-50 overflow-hidden">
                        {/* Preset options */}
                        {PRESET_OPTIONS.map(opt => (
                            <button
                                key={opt.value ?? 'null'}
                                type="button"
                                onClick={() => { onChange(opt.value); setShowDropdown(false); }}
                                className={`w-full px-3 py-2 text-left text-sm hover:bg-orange-50 transition-colors flex items-center gap-2 ${value === opt.value ? 'bg-orange-100 text-orange-700 font-medium' : 'text-gray-700'
                                    }`}
                            >
                                {opt.value === null ? <BellOff size={12} /> : <Bell size={12} />}
                                {opt.label}
                            </button>
                        ))}

                        {/* Custom input */}
                        <div className="border-t border-gray-100 p-2">
                            <div className="text-[10px] text-gray-400 mb-1.5">自訂提醒時間</div>
                            <div className="flex gap-1">
                                <input
                                    type="number"
                                    value={customValue}
                                    onChange={e => setCustomValue(e.target.value)}
                                    placeholder="數字"
                                    className="flex-1 px-2 py-1 text-xs border rounded w-14"
                                    min={1}
                                />
                                <select
                                    value={customUnit}
                                    onChange={e => setCustomUnit(e.target.value as any)}
                                    className="px-1 py-1 text-xs border rounded"
                                >
                                    <option value="minutes">分鐘</option>
                                    <option value="hours">小時</option>
                                    <option value="days">天</option>
                                </select>
                                <button
                                    type="button"
                                    onClick={handleCustomSubmit}
                                    className="px-2 py-1 text-xs bg-orange-500 text-white rounded hover:bg-orange-600"
                                >
                                    確定
                                </button>
                            </div>
                        </div>

                        {/* Clear button if has value */}
                        {hasReminder && (
                            <button
                                type="button"
                                onClick={() => { onChange(null); setShowDropdown(false); }}
                                className="w-full px-3 py-2 text-left text-xs text-red-500 hover:bg-red-50 border-t border-gray-100 flex items-center gap-2"
                            >
                                <X size={12} />
                                清除提醒
                            </button>
                        )}
                    </div>
                </>
            )}
        </div>
    );
};
