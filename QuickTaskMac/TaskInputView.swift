import SwiftUI

struct TaskInputView: View {
    @State private var title: String = ""
    @State private var notes: String = ""
    @State private var selectedColor: String = "#6366f1"
    @State private var startDate: Date? = nil
    @State private var dueDate: Date? = nil
    @State private var showStartDatePicker = false
    @State private var showDueDatePicker = false
    @State private var isSubmitting = false
    @State private var showSuccess = false
    @State private var errorMessage: String? = nil
    
    // Login states
    @State private var isLoggedIn = SupabaseService.shared.isLoggedIn
    @State private var email: String = ""
    @State private var password: String = ""
    @State private var isLoggingIn = false
    
    var closeAction: () -> Void
    
    let colors = [
        "#6366f1", // Indigo
        "#f43f5e", // Rose
        "#10b981", // Emerald
        "#f59e0b", // Amber
        "#3b82f6", // Blue
        "#8b5cf6", // Purple
        "#ec4899", // Pink
        "#64748b", // Slate
    ]
    
    var body: some View {
        ZStack {
            // Background
            RoundedRectangle(cornerRadius: 16)
                .fill(.ultraThinMaterial)
            
            VStack(spacing: 0) {
                // Header
                HStack {
                    Image(systemName: isLoggedIn ? "plus.circle.fill" : "person.circle.fill")
                        .font(.system(size: 24))
                        .foregroundColor(Color(hex: selectedColor))
                    
                    Text(isLoggedIn ? "快速新增任務" : "登入帳號")
                        .font(.system(size: 18, weight: .bold))
                    
                    Spacer()
                    
                    Button(action: closeAction) {
                        Image(systemName: "xmark.circle.fill")
                            .font(.system(size: 20))
                            .foregroundColor(.secondary)
                    }
                    .buttonStyle(.plain)
                }
                .padding(.horizontal, 20)
                .padding(.top, 20)
                .padding(.bottom, 16)
                
                Divider()
                
                if !isLoggedIn {
                    // Login Form
                    VStack(spacing: 20) {
                        Spacer()
                        
                        Image(systemName: "lock.shield")
                            .font(.system(size: 48))
                            .foregroundColor(.indigo)
                        
                        Text("請先登入您的帳號")
                            .font(.headline)
                        
                        VStack(spacing: 12) {
                            TextField("Email", text: $email)
                                .textFieldStyle(.roundedBorder)
                            
                            SecureField("密碼", text: $password)
                                .textFieldStyle(.roundedBorder)
                        }
                        .frame(maxWidth: 280)
                        
                        if let error = errorMessage {
                            Text(error)
                                .font(.caption)
                                .foregroundColor(.red)
                        }
                        
                        Button(action: login) {
                            HStack {
                                if isLoggingIn {
                                    ProgressView()
                                        .scaleEffect(0.7)
                                }
                                Text(isLoggingIn ? "登入中..." : "登入")
                            }
                            .frame(minWidth: 120)
                        }
                        .buttonStyle(.borderedProminent)
                        .disabled(email.isEmpty || password.isEmpty || isLoggingIn)
                        
                        Spacer()
                    }
                    .padding(20)
                } else {
                    // Task Input Form
                    ScrollView {
                        VStack(spacing: 16) {
                            // Title
                        VStack(alignment: .leading, spacing: 6) {
                            Text("任務標題")
                                .font(.system(size: 12, weight: .medium))
                                .foregroundColor(.secondary)
                            
                            TextField("輸入任務標題...", text: $title)
                                .textFieldStyle(.plain)
                                .font(.system(size: 16))
                                .padding(12)
                                .background(Color(nsColor: .controlBackgroundColor))
                                .cornerRadius(10)
                        }
                        
                        // Notes with Markdown preview
                        VStack(alignment: .leading, spacing: 6) {
                            HStack {
                                Text("備註")
                                    .font(.system(size: 12, weight: .medium))
                                    .foregroundColor(.secondary)
                                Spacer()
                                Text("支援 Markdown")
                                    .font(.system(size: 10))
                                    .foregroundColor(.secondary.opacity(0.6))
                            }
                            
                            // Split view: Editor + Preview
                            HStack(spacing: 8) {
                                // Editor
                                VStack(alignment: .leading, spacing: 4) {
                                    Text("編輯")
                                        .font(.system(size: 9, weight: .medium))
                                        .foregroundColor(.secondary.opacity(0.5))
                                    TextEditor(text: $notes)
                                        .font(.system(size: 13, design: .monospaced))
                                        .frame(minHeight: 120, maxHeight: 150)
                                        .padding(8)
                                        .background(Color(nsColor: .controlBackgroundColor))
                                        .cornerRadius(8)
                                }
                                .frame(maxWidth: .infinity)
                                
                                // Preview
                                VStack(alignment: .leading, spacing: 4) {
                                    Text("預覽")
                                        .font(.system(size: 9, weight: .medium))
                                        .foregroundColor(.secondary.opacity(0.5))
                                    ScrollView {
                                        VStack(alignment: .leading) {
                                            if notes.isEmpty {
                                                Text("Markdown 預覽...")
                                                    .foregroundColor(.secondary.opacity(0.4))
                                                    .font(.system(size: 13))
                                            } else {
                                                Text(markdownToAttributedString(notes))
                                                    .font(.system(size: 13))
                                                    .textSelection(.enabled)
                                            }
                                        }
                                        .frame(maxWidth: .infinity, alignment: .leading)
                                    }
                                    .frame(minHeight: 120, maxHeight: 150)
                                    .padding(8)
                                    .background(Color(nsColor: .windowBackgroundColor).opacity(0.5))
                                    .cornerRadius(8)
                                    .overlay(
                                        RoundedRectangle(cornerRadius: 8)
                                            .stroke(Color.secondary.opacity(0.1), lineWidth: 1)
                                    )
                                }
                                .frame(maxWidth: .infinity)
                            }
                        }
                        
                        // Color picker
                        VStack(alignment: .leading, spacing: 6) {
                            Text("顏色標籤")
                                .font(.system(size: 12, weight: .medium))
                                .foregroundColor(.secondary)
                            
                            HStack(spacing: 10) {
                                ForEach(colors, id: \.self) { color in
                                    Circle()
                                        .fill(Color(hex: color))
                                        .frame(width: 28, height: 28)
                                        .overlay(
                                            Circle()
                                                .stroke(Color.white, lineWidth: selectedColor == color ? 3 : 0)
                                        )
                                        .shadow(color: selectedColor == color ? Color(hex: color).opacity(0.5) : .clear, radius: 4)
                                        .onTapGesture {
                                            withAnimation(.spring(response: 0.3)) {
                                                selectedColor = color
                                            }
                                        }
                                }
                            }
                        }
                        
                        // Dates
                        HStack(spacing: 16) {
                            // Start Date
                            VStack(alignment: .leading, spacing: 6) {
                                Text("開始日期")
                                    .font(.system(size: 12, weight: .medium))
                                    .foregroundColor(.secondary)
                                
                                Button(action: { showStartDatePicker.toggle() }) {
                                    HStack {
                                        Image(systemName: "calendar")
                                            .foregroundColor(.secondary)
                                        Text(startDate?.formatted(date: .abbreviated, time: .omitted) ?? "選擇日期")
                                            .foregroundColor(startDate != nil ? .primary : .secondary)
                                        Spacer()
                                        if startDate != nil {
                                            Button(action: { startDate = nil }) {
                                                Image(systemName: "xmark.circle.fill")
                                                    .foregroundColor(.secondary)
                                            }
                                            .buttonStyle(.plain)
                                        }
                                    }
                                    .padding(10)
                                    .background(Color(nsColor: .controlBackgroundColor))
                                    .cornerRadius(8)
                                }
                                .buttonStyle(.plain)
                                
                                if showStartDatePicker {
                                    DatePicker("", selection: Binding(
                                        get: { startDate ?? Date() },
                                        set: { startDate = $0 }
                                    ), displayedComponents: [.date])
                                    .datePickerStyle(.graphical)
                                    .labelsHidden()
                                }
                            }
                            
                            // Due Date
                            VStack(alignment: .leading, spacing: 6) {
                                Text("截止日期")
                                    .font(.system(size: 12, weight: .medium))
                                    .foregroundColor(.secondary)
                                
                                Button(action: { showDueDatePicker.toggle() }) {
                                    HStack {
                                        Image(systemName: "flag")
                                            .foregroundColor(.secondary)
                                        Text(dueDate?.formatted(date: .abbreviated, time: .omitted) ?? "選擇日期")
                                            .foregroundColor(dueDate != nil ? .primary : .secondary)
                                        Spacer()
                                        if dueDate != nil {
                                            Button(action: { dueDate = nil }) {
                                                Image(systemName: "xmark.circle.fill")
                                                    .foregroundColor(.secondary)
                                            }
                                            .buttonStyle(.plain)
                                        }
                                    }
                                    .padding(10)
                                    .background(Color(nsColor: .controlBackgroundColor))
                                    .cornerRadius(8)
                                }
                                .buttonStyle(.plain)
                                
                                if showDueDatePicker {
                                    DatePicker("", selection: Binding(
                                        get: { dueDate ?? Date() },
                                        set: { dueDate = $0 }
                                    ), displayedComponents: [.date])
                                    .datePickerStyle(.graphical)
                                    .labelsHidden()
                                }
                            }
                        }
                        
                        // Error message
                        if let error = errorMessage {
                            Text(error)
                                .font(.system(size: 12))
                                .foregroundColor(.red)
                                .padding(.horizontal)
                        }
                    }
                    .padding(20)
                }
                } // End of else (logged in)
                
                if isLoggedIn {
                    Divider()
                    
                    // Footer buttons
                    HStack {
                        Button("取消") {
                            closeAction()
                        }
                        .keyboardShortcut(.escape, modifiers: [])
                        
                        Spacer()
                        
                        Button(action: submitTask) {
                            HStack {
                                if isSubmitting {
                                    ProgressView()
                                        .scaleEffect(0.7)
                                }
                                Text(showSuccess ? "已新增 ✓" : "新增任務")
                            }
                            .frame(minWidth: 100)
                        }
                        .buttonStyle(.borderedProminent)
                        .tint(Color(hex: selectedColor))
                        .disabled(title.isEmpty || isSubmitting)
                        .keyboardShortcut(.return, modifiers: .command)
                    }
                    .padding(16)
                }
            }
        }
        .frame(width: 480, height: 600)
        .onAppear {
            // Focus on title field
        }
    }
    
    func submitTask() {
        guard !title.isEmpty else { return }
        
        isSubmitting = true
        errorMessage = nil
        
        Task {
            do {
                try await SupabaseService.shared.createTask(
                    title: title,
                    notes: notes,
                    color: selectedColor,
                    startDate: startDate,
                    dueDate: dueDate
                )
                
                await MainActor.run {
                    isSubmitting = false
                    showSuccess = true
                    
                    // Reset form after delay
                    DispatchQueue.main.asyncAfter(deadline: .now() + 0.8) {
                        title = ""
                        notes = ""
                        showSuccess = false
                        closeAction()
                    }
                }
            } catch {
                await MainActor.run {
                    isSubmitting = false
                    errorMessage = "新增失敗: \(error.localizedDescription)"
                }
            }
        }
    }
    
    func login() {
        isLoggingIn = true
        errorMessage = nil
        
        Task {
            do {
                _ = try await SupabaseService.shared.login(email: email, password: password)
                await MainActor.run {
                    isLoggingIn = false
                    isLoggedIn = true
                }
            } catch {
                await MainActor.run {
                    isLoggingIn = false
                    errorMessage = "登入失敗: \(error.localizedDescription)"
                }
            }
        }
    }
    
    // Convert markdown text to AttributedString
    func markdownToAttributedString(_ markdown: String) -> AttributedString {
        do {
            var attributedString = try AttributedString(markdown: markdown, options: AttributedString.MarkdownParsingOptions(interpretedSyntax: .inlineOnlyPreservingWhitespace))
            return attributedString
        } catch {
            // Fallback to plain text if markdown parsing fails
            return AttributedString(markdown)
        }
    }
}

// Color extension for hex
extension Color {
    init(hex: String) {
        let hex = hex.trimmingCharacters(in: CharacterSet.alphanumerics.inverted)
        var int: UInt64 = 0
        Scanner(string: hex).scanHexInt64(&int)
        let a, r, g, b: UInt64
        switch hex.count {
        case 3: // RGB (12-bit)
            (a, r, g, b) = (255, (int >> 8) * 17, (int >> 4 & 0xF) * 17, (int & 0xF) * 17)
        case 6: // RGB (24-bit)
            (a, r, g, b) = (255, int >> 16, int >> 8 & 0xFF, int & 0xFF)
        case 8: // ARGB (32-bit)
            (a, r, g, b) = (int >> 24, int >> 16 & 0xFF, int >> 8 & 0xFF, int & 0xFF)
        default:
            (a, r, g, b) = (1, 1, 1, 0)
        }
        self.init(
            .sRGB,
            red: Double(r) / 255,
            green: Double(g) / 255,
            blue: Double(b) / 255,
            opacity: Double(a) / 255
        )
    }
}

#Preview {
    TaskInputView(closeAction: {})
}
