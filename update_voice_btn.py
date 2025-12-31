import sys

file_path = 'src/components/TaskInput.tsx'
start_line = 2400 - 1  # 0-indexed
end_line = 2417       # Exclusive in python slice? No, 2417 lines means index 2417 is line 2418.
# Range is inclusive 2400 to 2417.
# 0-indexed: 2399 to 2417 (exclusive) -> NO.
# Line 2400 is index 2399.
# Line 2417 is index 2416.
# We want to replace indices 2399 to 2417 (so 2417-2399 = 18 lines).

new_content = """                                    {/* Voice Note Button */}
                                    <button
                                        type="button"
                                        tabIndex={-1}
                                        onMouseDown={(e) => e.preventDefault()}
                                        onClick={() => {
                                            // Trigger recording on NoteEditor via ref
                                            if (editorRef.current && (editorRef.current as any).toggleRecording) {
                                                (editorRef.current as any).toggleRecording();
                                            } else {
                                                setToast?.({ msg: "錄音功能尚未準備就緒", type: "error" });
                                            }
                                        }}
                                        className={`flex items-center gap-1.5 px-2.5 py-1.5 rounded-md transition-all border border-transparent hover:border-theme hover:bg-theme-hover text-theme-tertiary hover:text-theme-secondary focus:outline-none focus:bg-theme-card focus:ring-1 ${theme?.buttonRing || 'focus:ring-indigo-300'} focus:border-theme text-xs ${themeSettings.fontWeight === 'thin' ? 'font-light' : 'font-medium'}`}
                                        title="開始錄音"
                                    >
                                        <Mic size={13} />
                                        <span>語音</span>
                                    </button>"""

with open(file_path, 'r') as f:
    lines = f.readlines()

# Verify the marker content to be safe
print(f"Replacing lines {start_line+1} to {end_line}")
print("First line being replaced:", lines[start_line].strip())
print("Last line being replaced:", lines[end_line].strip()) # Check line 2418? No check 2417.
# wait, index 2416 is line 2417.

lines[start_line:end_line] = [new_content + '\n']

with open(file_path, 'w') as f:
    f.writelines(lines)
