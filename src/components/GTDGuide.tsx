import React, { useState } from 'react';
import { X, ChevronRight, ChevronLeft, Lightbulb, Target, Clock, BookOpen, CheckCircle, Inbox, ListTodo, Calendar, Sparkles, ArrowRight } from 'lucide-react';

interface GTDGuideProps {
    isOpen: boolean;
    onClose: () => void;
    initialModule?: 'capture' | 'clarify' | 'organize' | 'project' | 'timebox' | 'journal';
}

interface GuideStep {
    title: string;
    content: React.ReactNode;
    tip?: string;
    action?: string;
}

const GTDGuide: React.FC<GTDGuideProps> = ({ isOpen, onClose, initialModule = 'capture' }) => {
    const [currentModule, setCurrentModule] = useState(initialModule);
    const [currentStep, setCurrentStep] = useState(0);

    const modules = [
        { id: 'capture', icon: Inbox, label: '收集', color: 'indigo' },
        { id: 'clarify', icon: Lightbulb, label: '釐清', color: 'amber' },
        { id: 'organize', icon: ListTodo, label: '整理', color: 'emerald' },
        { id: 'project', icon: Target, label: '專案', color: 'purple' },
        { id: 'timebox', icon: Clock, label: '時間盒', color: 'blue' },
        { id: 'journal', icon: BookOpen, label: '日記', color: 'rose' },
    ];

    const guideContent: Record<string, GuideStep[]> = {
        capture: [
            {
                title: '🧠 第一步：清空大腦',
                content: (
                    <div className="space-y-4">
                        <p className="text-gray-600 leading-relaxed">
                            GTD 的第一步是<strong>收集</strong>。把所有佔據你大腦的想法、任務、承諾都記錄下來。
                        </p>
                        <div className="bg-indigo-50 rounded-xl p-4 border border-indigo-100">
                            <h4 className="font-bold text-indigo-700 mb-2">💡 這樣做：</h4>
                            <ul className="space-y-2 text-sm text-indigo-600">
                                <li>• 按下 <kbd className="px-1.5 py-0.5 bg-white rounded border text-xs">N</kbd> 快速新增任務</li>
                                <li>• 不用想太多，先全部記下來</li>
                                <li>• 想到什麼就寫什麼</li>
                            </ul>
                        </div>
                    </div>
                ),
                tip: '現在就試試：想想最近有什麼事情一直掛在心上？',
                action: '開始收集'
            },
            {
                title: '📥 收件匣是你的好朋友',
                content: (
                    <div className="space-y-4">
                        <p className="text-gray-600 leading-relaxed">
                            所有新任務都會先進入<strong>收件匣</strong>。這裡是暫存區，不需要馬上處理。
                        </p>
                        <div className="bg-gray-50 rounded-xl p-4 border border-gray-200">
                            <h4 className="font-bold text-gray-700 mb-2">📋 收集清單範例：</h4>
                            <ul className="space-y-1.5 text-sm text-gray-600">
                                <li>✓ 回覆客戶 Email</li>
                                <li>✓ 買生日禮物</li>
                                <li>✓ 預約牙醫</li>
                                <li>✓ 研究新專案方案</li>
                                <li>✓ 整理房間</li>
                            </ul>
                        </div>
                    </div>
                ),
                tip: '每天花 5 分鐘收集，保持收件匣流通'
            },
            {
                title: '✅ 收集的黃金法則',
                content: (
                    <div className="space-y-4">
                        <div className="grid gap-3">
                            <div className="bg-green-50 rounded-lg p-3 border border-green-100">
                                <div className="flex items-start gap-2">
                                    <CheckCircle className="text-green-500 mt-0.5" size={18} />
                                    <div>
                                        <h5 className="font-bold text-green-700">快速記錄</h5>
                                        <p className="text-sm text-green-600">不用完美，先記下來再說</p>
                                    </div>
                                </div>
                            </div>
                            <div className="bg-green-50 rounded-lg p-3 border border-green-100">
                                <div className="flex items-start gap-2">
                                    <CheckCircle className="text-green-500 mt-0.5" size={18} />
                                    <div>
                                        <h5 className="font-bold text-green-700">定期清空大腦</h5>
                                        <p className="text-sm text-green-600">每天至少一次，把想法都寫下來</p>
                                    </div>
                                </div>
                            </div>
                            <div className="bg-green-50 rounded-lg p-3 border border-green-100">
                                <div className="flex items-start gap-2">
                                    <CheckCircle className="text-green-500 mt-0.5" size={18} />
                                    <div>
                                        <h5 className="font-bold text-green-700">信任你的系統</h5>
                                        <p className="text-sm text-green-600">記下來後就可以放心忘記</p>
                                    </div>
                                </div>
                            </div>
                        </div>
                    </div>
                ),
                tip: '記住：你的大腦是用來思考的，不是用來記事的！'
            }
        ],
        clarify: [
            {
                title: '🔍 釐清：這是什麼？',
                content: (
                    <div className="space-y-4">
                        <p className="text-gray-600 leading-relaxed">
                            收集完成後，對每個項目問自己：<strong>「這是什麼？需要採取行動嗎？」</strong>
                        </p>
                        <div className="bg-amber-50 rounded-xl p-4 border border-amber-100">
                            <h4 className="font-bold text-amber-700 mb-3">🤔 問自己這些問題：</h4>
                            <div className="space-y-2 text-sm">
                                <div className="flex items-center gap-2 text-amber-700">
                                    <ArrowRight size={14} />
                                    <span>這件事可以採取行動嗎？</span>
                                </div>
                                <div className="flex items-center gap-2 text-amber-700">
                                    <ArrowRight size={14} />
                                    <span>下一步具體是什麼？</span>
                                </div>
                                <div className="flex items-center gap-2 text-amber-700">
                                    <ArrowRight size={14} />
                                    <span>這需要 2 分鐘以內能完成嗎？</span>
                                </div>
                            </div>
                        </div>
                    </div>
                ),
                tip: '如果 2 分鐘內能完成，現在就做！'
            },
            {
                title: '⚡ 兩分鐘法則',
                content: (
                    <div className="space-y-4">
                        <div className="text-center py-4">
                            <div className="inline-block bg-gradient-to-r from-amber-400 to-orange-400 text-white px-6 py-3 rounded-2xl font-bold text-lg shadow-lg">
                                2 分鐘內能做完？立刻做！
                            </div>
                        </div>
                        <p className="text-gray-600 leading-relaxed text-center">
                            記錄和追蹤一件小事的時間，可能比完成它還久。
                        </p>
                        <div className="bg-gray-50 rounded-xl p-4 border border-gray-200">
                            <h4 className="font-bold text-gray-700 mb-2">⚡ 兩分鐘任務範例：</h4>
                            <ul className="space-y-1.5 text-sm text-gray-600">
                                <li>• 回覆一封簡短 Email</li>
                                <li>• 打一通快速電話</li>
                                <li>• 簽署一份文件</li>
                                <li>• 把碗放進洗碗機</li>
                            </ul>
                        </div>
                    </div>
                ),
                tip: '不要把小事變成待辦事項！'
            },
            {
                title: '📝 具體化你的任務',
                content: (
                    <div className="space-y-4">
                        <p className="text-gray-600 leading-relaxed">
                            模糊的任務會讓你拖延。把任務寫成<strong>具體的下一步行動</strong>。
                        </p>
                        <div className="grid gap-3">
                            <div className="flex items-center gap-3 p-3 bg-red-50 rounded-lg border border-red-100">
                                <X className="text-red-500" size={20} />
                                <span className="text-red-700">準備會議</span>
                            </div>
                            <div className="flex items-center justify-center">
                                <ArrowRight className="text-gray-400" size={20} />
                            </div>
                            <div className="flex items-center gap-3 p-3 bg-green-50 rounded-lg border border-green-100">
                                <CheckCircle className="text-green-500" size={20} />
                                <span className="text-green-700">寫出週三會議的 3 個議題</span>
                            </div>
                        </div>
                    </div>
                ),
                tip: '任務標題要以動詞開頭：寫、打、發、買、預約...'
            }
        ],
        organize: [
            {
                title: '📂 整理：放到對的地方',
                content: (
                    <div className="space-y-4">
                        <p className="text-gray-600 leading-relaxed">
                            釐清後，把任務放到適合的位置：
                        </p>
                        <div className="grid gap-2">
                            <div className="flex items-center gap-3 p-3 bg-blue-50 rounded-lg border border-blue-100">
                                <Calendar className="text-blue-500" size={20} />
                                <div>
                                    <span className="font-bold text-blue-700">今天</span>
                                    <p className="text-xs text-blue-600">今天必須完成的任務</p>
                                </div>
                            </div>
                            <div className="flex items-center gap-3 p-3 bg-purple-50 rounded-lg border border-purple-100">
                                <ListTodo className="text-purple-500" size={20} />
                                <div>
                                    <span className="font-bold text-purple-700">預定</span>
                                    <p className="text-xs text-purple-600">有開始日期的任務</p>
                                </div>
                            </div>
                            <div className="flex items-center gap-3 p-3 bg-amber-50 rounded-lg border border-amber-100">
                                <Inbox className="text-amber-500" size={20} />
                                <div>
                                    <span className="font-bold text-amber-700">稍後</span>
                                    <p className="text-xs text-amber-600">未來某天要做，但還沒決定時間</p>
                                </div>
                            </div>
                        </div>
                    </div>
                ),
                tip: '使用標籤來分類任務的情境：@電腦、@外出、@電話...'
            },
            {
                title: '🏷️ 善用標籤系統',
                content: (
                    <div className="space-y-4">
                        <p className="text-gray-600 leading-relaxed">
                            標籤可以幫你快速篩選任務，找到「此時此刻最適合做的事」。
                        </p>
                        <div className="bg-emerald-50 rounded-xl p-4 border border-emerald-100">
                            <h4 className="font-bold text-emerald-700 mb-3">🏷️ 建議的標籤類型：</h4>
                            <div className="space-y-2 text-sm">
                                <div className="flex items-center gap-2">
                                    <span className="px-2 py-0.5 bg-blue-100 text-blue-700 rounded-full text-xs">@情境</span>
                                    <span className="text-gray-600">電腦、手機、外出、家裡</span>
                                </div>
                                <div className="flex items-center gap-2">
                                    <span className="px-2 py-0.5 bg-purple-100 text-purple-700 rounded-full text-xs">@人物</span>
                                    <span className="text-gray-600">老闆、同事名字、家人</span>
                                </div>
                                <div className="flex items-center gap-2">
                                    <span className="px-2 py-0.5 bg-amber-100 text-amber-700 rounded-full text-xs">@能量</span>
                                    <span className="text-gray-600">高專注、低能量</span>
                                </div>
                                <div className="flex items-center gap-2">
                                    <span className="px-2 py-0.5 bg-green-100 text-green-700 rounded-full text-xs">@時間</span>
                                    <span className="text-gray-600">5分鐘、30分鐘、1小時</span>
                                </div>
                            </div>
                        </div>
                    </div>
                ),
                tip: '在側邊欄點擊「+」來新增標籤'
            }
        ],
        project: [
            {
                title: '🎯 專案：需要多個步驟的目標',
                content: (
                    <div className="space-y-4">
                        <p className="text-gray-600 leading-relaxed">
                            如果一件事需要<strong>兩個以上的行動</strong>才能完成，那就是一個「專案」。
                        </p>
                        <div className="bg-purple-50 rounded-xl p-4 border border-purple-100">
                            <h4 className="font-bold text-purple-700 mb-2">📁 專案範例：</h4>
                            <ul className="space-y-1.5 text-sm text-purple-600">
                                <li>• 🏠 裝修房子</li>
                                <li>• 📚 完成線上課程</li>
                                <li>• 🎂 籌備生日派對</li>
                                <li>• 🚀 發布新產品功能</li>
                            </ul>
                        </div>
                    </div>
                ),
                tip: '把任務轉換成專案：點擊任務卡片，勾選「設為專案」'
            },
            {
                title: '📋 設計專案的步驟',
                content: (
                    <div className="space-y-4">
                        <div className="space-y-3">
                            <div className="flex items-start gap-3 p-3 bg-gray-50 rounded-lg">
                                <div className="w-6 h-6 rounded-full bg-purple-500 text-white flex items-center justify-center text-sm font-bold">1</div>
                                <div>
                                    <h5 className="font-bold text-gray-700">定義成功的樣子</h5>
                                    <p className="text-sm text-gray-500">這個專案完成時，會是什麼狀態？</p>
                                </div>
                            </div>
                            <div className="flex items-start gap-3 p-3 bg-gray-50 rounded-lg">
                                <div className="w-6 h-6 rounded-full bg-purple-500 text-white flex items-center justify-center text-sm font-bold">2</div>
                                <div>
                                    <h5 className="font-bold text-gray-700">腦力激盪所有步驟</h5>
                                    <p className="text-sm text-gray-500">不用排序，先把想到的都記下來</p>
                                </div>
                            </div>
                            <div className="flex items-start gap-3 p-3 bg-gray-50 rounded-lg">
                                <div className="w-6 h-6 rounded-full bg-purple-500 text-white flex items-center justify-center text-sm font-bold">3</div>
                                <div>
                                    <h5 className="font-bold text-gray-700">安排順序</h5>
                                    <p className="text-sm text-gray-500">哪些事要先做？有什麼依賴關係？</p>
                                </div>
                            </div>
                            <div className="flex items-start gap-3 p-3 bg-gray-50 rounded-lg">
                                <div className="w-6 h-6 rounded-full bg-purple-500 text-white flex items-center justify-center text-sm font-bold">4</div>
                                <div>
                                    <h5 className="font-bold text-gray-700">確定下一步行動</h5>
                                    <p className="text-sm text-gray-500">現在就可以開始做的是什麼？</p>
                                </div>
                            </div>
                        </div>
                    </div>
                ),
                tip: '每個專案都要有一個「下一步行動」！'
            },
            {
                title: '➕ 在專案下新增子任務',
                content: (
                    <div className="space-y-4">
                        <p className="text-gray-600 leading-relaxed">
                            建立專案後，可以在下面新增子任務，拆解大目標成小步驟。
                        </p>
                        <div className="bg-indigo-50 rounded-xl p-4 border border-indigo-100">
                            <h4 className="font-bold text-indigo-700 mb-2">💡 操作方式：</h4>
                            <ul className="space-y-2 text-sm text-indigo-600">
                                <li>1. 點擊專案任務卡片</li>
                                <li>2. 在備註區用 <kbd className="px-1.5 py-0.5 bg-white rounded border text-xs">-</kbd> 開始寫列表</li>
                                <li>3. 或在專案下方點擊「新增子任務」</li>
                            </ul>
                        </div>
                        <div className="p-3 bg-gray-50 rounded-lg border">
                            <p className="text-xs text-gray-500 mb-2">📁 專案：籌備生日派對</p>
                            <div className="space-y-1 pl-4 text-sm text-gray-600">
                                <div>☐ 確認賓客名單</div>
                                <div>☐ 預訂餐廳</div>
                                <div>☐ 訂蛋糕</div>
                                <div>☐ 準備禮物</div>
                            </div>
                        </div>
                    </div>
                ),
                tip: '專案進度會自動根據子任務完成數計算'
            }
        ],
        timebox: [
            {
                title: '⏰ 時間盒工作法',
                content: (
                    <div className="space-y-4">
                        <p className="text-gray-600 leading-relaxed">
                            時間盒（Timeboxing）是把特定時間區塊分配給特定任務的方法。
                        </p>
                        <div className="bg-blue-50 rounded-xl p-4 border border-blue-100">
                            <h4 className="font-bold text-blue-700 mb-3">🎯 時間盒的好處：</h4>
                            <div className="space-y-2 text-sm text-blue-600">
                                <div className="flex items-center gap-2">
                                    <CheckCircle size={14} />
                                    <span>專注在一件事上</span>
                                </div>
                                <div className="flex items-center gap-2">
                                    <CheckCircle size={14} />
                                    <span>避免任務無限延長</span>
                                </div>
                                <div className="flex items-center gap-2">
                                    <CheckCircle size={14} />
                                    <span>更容易進入心流狀態</span>
                                </div>
                                <div className="flex items-center gap-2">
                                    <CheckCircle size={14} />
                                    <span>減少決策疲勞</span>
                                </div>
                            </div>
                        </div>
                    </div>
                ),
                tip: '試試看：給自己 25 分鐘專注處理一件事'
            },
            {
                title: '📅 使用行事曆視圖',
                content: (
                    <div className="space-y-4">
                        <p className="text-gray-600 leading-relaxed">
                            在側邊欄點擊<strong>「行事曆」</strong>切換到時間視圖，把任務拖曳到時間軸上。
                        </p>
                        <div className="bg-gray-50 rounded-xl p-4 border border-gray-200">
                            <h4 className="font-bold text-gray-700 mb-2">📋 設定任務時間：</h4>
                            <ul className="space-y-2 text-sm text-gray-600">
                                <li>1. 點擊任務卡片打開編輯</li>
                                <li>2. 設定「開始時間」和「持續時間」</li>
                                <li>3. 任務會顯示在行事曆上</li>
                            </ul>
                        </div>
                        <div className="flex items-center gap-2 text-sm text-gray-500">
                            <Clock size={16} />
                            <span>建議：每個時間盒 25-90 分鐘</span>
                        </div>
                    </div>
                ),
                tip: '別忘了安排休息時間！'
            },
            {
                title: '🍅 番茄鐘技巧',
                content: (
                    <div className="space-y-4">
                        <div className="text-center py-3">
                            <div className="inline-block bg-gradient-to-r from-red-400 to-orange-400 text-white px-5 py-2 rounded-xl font-bold shadow-lg">
                                🍅 25 分鐘工作 + 5 分鐘休息
                            </div>
                        </div>
                        <div className="space-y-2">
                            <div className="flex items-center gap-3 p-2 bg-red-50 rounded-lg">
                                <span className="text-2xl">🍅</span>
                                <span className="text-sm text-red-700">專注工作 25 分鐘</span>
                            </div>
                            <div className="flex items-center gap-3 p-2 bg-green-50 rounded-lg">
                                <span className="text-2xl">☕</span>
                                <span className="text-sm text-green-700">短休息 5 分鐘</span>
                            </div>
                            <div className="flex items-center gap-3 p-2 bg-blue-50 rounded-lg">
                                <span className="text-2xl">🔄</span>
                                <span className="text-sm text-blue-700">重複 4 次後，長休息 15-30 分鐘</span>
                            </div>
                        </div>
                    </div>
                ),
                tip: '任務的持續時間可以設為 25 分鐘來實踐番茄鐘'
            }
        ],
        journal: [
            {
                title: '📔 每日日記',
                content: (
                    <div className="space-y-4">
                        <p className="text-gray-600 leading-relaxed">
                            每日回顧是 GTD 的重要習慣。用備註功能寫下今天的反思。
                        </p>
                        <div className="bg-rose-50 rounded-xl p-4 border border-rose-100">
                            <h4 className="font-bold text-rose-700 mb-3">📝 每日日記模板：</h4>
                            <div className="space-y-2 text-sm text-rose-600 font-mono bg-white p-3 rounded-lg">
                                <p>## 今日回顧</p>
                                <p>- 完成了什麼？</p>
                                <p>- 學到了什麼？</p>
                                <p>- 感謝什麼？</p>
                                <p></p>
                                <p>## 明日計畫</p>
                                <p>- 最重要的 3 件事</p>
                            </div>
                        </div>
                    </div>
                ),
                tip: '建議：每天固定時間寫，例如睡前 10 分鐘'
            },
            {
                title: '🌅 晨間規劃',
                content: (
                    <div className="space-y-4">
                        <p className="text-gray-600 leading-relaxed">
                            每天早上花 5-10 分鐘規劃今天，讓一整天更有方向。
                        </p>
                        <div className="space-y-3">
                            <div className="flex items-start gap-3 p-3 bg-amber-50 rounded-lg border border-amber-100">
                                <span className="text-xl">☀️</span>
                                <div>
                                    <h5 className="font-bold text-amber-700">查看收件匣</h5>
                                    <p className="text-sm text-amber-600">處理昨晚或今早新增的項目</p>
                                </div>
                            </div>
                            <div className="flex items-start gap-3 p-3 bg-blue-50 rounded-lg border border-blue-100">
                                <span className="text-xl">📋</span>
                                <div>
                                    <h5 className="font-bold text-blue-700">檢視「今天」列表</h5>
                                    <p className="text-sm text-blue-600">確認今天要完成的任務</p>
                                </div>
                            </div>
                            <div className="flex items-start gap-3 p-3 bg-purple-50 rounded-lg border border-purple-100">
                                <span className="text-xl">🎯</span>
                                <div>
                                    <h5 className="font-bold text-purple-700">選出 3 件最重要的事</h5>
                                    <p className="text-sm text-purple-600">如果今天只能完成 3 件事，是哪 3 件？</p>
                                </div>
                            </div>
                        </div>
                    </div>
                ),
                tip: '把晨間規劃變成習慣，人生會更有掌控感'
            },
            {
                title: '🌙 每週回顧',
                content: (
                    <div className="space-y-4">
                        <p className="text-gray-600 leading-relaxed">
                            每週花 30-60 分鐘做完整回顧，這是 GTD 最關鍵的習慣！
                        </p>
                        <div className="bg-indigo-50 rounded-xl p-4 border border-indigo-100">
                            <h4 className="font-bold text-indigo-700 mb-3">📋 每週回顧清單：</h4>
                            <div className="space-y-2 text-sm text-indigo-600">
                                <div className="flex items-center gap-2">
                                    <input type="checkbox" className="rounded" />
                                    <span>清空所有收件匣</span>
                                </div>
                                <div className="flex items-center gap-2">
                                    <input type="checkbox" className="rounded" />
                                    <span>檢視所有進行中的專案</span>
                                </div>
                                <div className="flex items-center gap-2">
                                    <input type="checkbox" className="rounded" />
                                    <span>更新專案的下一步行動</span>
                                </div>
                                <div className="flex items-center gap-2">
                                    <input type="checkbox" className="rounded" />
                                    <span>檢視行事曆（過去和未來）</span>
                                </div>
                                <div className="flex items-center gap-2">
                                    <input type="checkbox" className="rounded" />
                                    <span>清理「稍後」和「等待中」列表</span>
                                </div>
                            </div>
                        </div>
                    </div>
                ),
                tip: '建議每週五下午或週日晚上進行每週回顧'
            }
        ]
    };

    const currentSteps = guideContent[currentModule] || [];
    const currentStepData = currentSteps[currentStep];
    const currentModuleData = modules.find(m => m.id === currentModule);

    const handleNext = () => {
        if (currentStep < currentSteps.length - 1) {
            setCurrentStep(currentStep + 1);
        } else {
            // Move to next module
            const currentIndex = modules.findIndex(m => m.id === currentModule);
            if (currentIndex < modules.length - 1) {
                setCurrentModule(modules[currentIndex + 1].id as any);
                setCurrentStep(0);
            }
        }
    };

    const handlePrev = () => {
        if (currentStep > 0) {
            setCurrentStep(currentStep - 1);
        } else {
            // Move to previous module
            const currentIndex = modules.findIndex(m => m.id === currentModule);
            if (currentIndex > 0) {
                const prevModule = modules[currentIndex - 1].id as any;
                setCurrentModule(prevModule);
                setCurrentStep(guideContent[prevModule].length - 1);
            }
        }
    };

    if (!isOpen) return null;

    return (
        <div className="fixed inset-0 z-[99999] flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm animate-in fade-in duration-200">
            <div className="bg-white rounded-2xl shadow-2xl w-full max-w-2xl max-h-[90vh] overflow-hidden animate-in zoom-in-95 duration-300">
                {/* Header */}
                <div className="bg-gradient-to-r from-indigo-500 to-purple-500 text-white p-4">
                    <div className="flex items-center justify-between">
                        <div className="flex items-center gap-3">
                            <div className="w-10 h-10 bg-white/20 rounded-xl flex items-center justify-center">
                                <Sparkles size={22} />
                            </div>
                            <div>
                                <h2 className="font-bold text-lg">GTD 完全指南</h2>
                                <p className="text-white/80 text-sm">掌握高效工作的藝術</p>
                            </div>
                        </div>
                        <button
                            onClick={onClose}
                            className="p-2 hover:bg-white/20 rounded-lg transition-colors"
                        >
                            <X size={20} />
                        </button>
                    </div>

                    {/* Module Tabs */}
                    <div className="flex gap-1 mt-4 overflow-x-auto pb-1">
                        {modules.map(({ id, icon: Icon, label }) => (
                            <button
                                key={id}
                                onClick={() => {
                                    setCurrentModule(id as any);
                                    setCurrentStep(0);
                                }}
                                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm font-medium transition-all whitespace-nowrap ${currentModule === id
                                    ? 'bg-white text-indigo-600'
                                    : 'text-white/80 hover:bg-white/20'
                                    }`}
                            >
                                <Icon size={14} />
                                {label}
                            </button>
                        ))}
                    </div>
                </div>

                {/* Content */}
                <div className="p-6 overflow-y-auto max-h-[50vh]">
                    {currentStepData && (
                        <>
                            <h3 className="text-xl font-bold text-gray-800 mb-4">
                                {currentStepData.title}
                            </h3>
                            {currentStepData.content}

                            {currentStepData.tip && (
                                <div className="mt-4 p-3 bg-amber-50 border border-amber-200 rounded-xl flex items-start gap-2">
                                    <Lightbulb className="text-amber-500 flex-shrink-0 mt-0.5" size={18} />
                                    <p className="text-sm text-amber-700">{currentStepData.tip}</p>
                                </div>
                            )}
                        </>
                    )}
                </div>

                {/* Footer */}
                <div className="border-t border-gray-100 p-4 bg-gray-50">
                    <div className="flex items-center justify-between">
                        <div className="text-sm text-gray-500">
                            {currentModuleData?.label} · {currentStep + 1} / {currentSteps.length}
                        </div>
                        <div className="flex items-center gap-2">
                            <button
                                onClick={handlePrev}
                                disabled={currentStep === 0 && currentModule === 'capture'}
                                className="flex items-center gap-1 px-4 py-2 text-gray-600 hover:bg-gray-100 rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                            >
                                <ChevronLeft size={18} />
                                上一步
                            </button>
                            <button
                                onClick={handleNext}
                                className="flex items-center gap-1 px-4 py-2 bg-indigo-500 text-white rounded-lg hover:bg-indigo-600 transition-colors font-medium"
                            >
                                {currentStep === currentSteps.length - 1 && currentModule === 'journal'
                                    ? '完成'
                                    : '下一步'}
                                <ChevronRight size={18} />
                            </button>
                        </div>
                    </div>

                    {/* Progress dots */}
                    <div className="flex justify-center gap-1 mt-3">
                        {currentSteps.map((_, idx) => (
                            <button
                                key={idx}
                                onClick={() => setCurrentStep(idx)}
                                className={`w-2 h-2 rounded-full transition-colors ${idx === currentStep ? 'bg-indigo-500' : 'bg-gray-300 hover:bg-gray-400'
                                    }`}
                            />
                        ))}
                    </div>
                </div>
            </div>
        </div>
    );
};

export default GTDGuide;
