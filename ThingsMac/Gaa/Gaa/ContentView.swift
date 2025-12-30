import SwiftUI

// Alias for async Task to avoid conflict with TaskItem
typealias AsyncTask = _Concurrency.Task

struct ContentView: View {
    @EnvironmentObject var appState: AppState
    @State private var sidebarWidth: CGFloat = 220
    
    var body: some View {
        if appState.isLoggedIn {
            HSplitView {
                // Sidebar
                SidebarView()
                    .frame(minWidth: 180, idealWidth: sidebarWidth, maxWidth: 300)
                
                // Main Content
                MainContentView()
                    .frame(minWidth: 400)
            }
            .sheet(isPresented: $appState.showQuickAdd) {
                QuickAddView()
                    .environmentObject(appState)
            }
            .sheet(item: Binding(
                get: { appState.selectedTaskId.map { SelectedTask(id: $0) } },
                set: { appState.selectedTaskId = $0?.id }
            )) { selectedTask in
                TaskDetailView(taskId: selectedTask.id)
                    .environmentObject(appState)
            }
        } else {
            LoginView()
                .environmentObject(appState)
        }
    }
}

// Helper for sheet item binding
struct SelectedTask: Identifiable {
    let id: String
}

// MARK: - Sidebar
struct SidebarView: View {
    @EnvironmentObject var appState: AppState
    
    var body: some View {
        VStack(spacing: 0) {
            // Search
            HStack {
                Image(systemName: "magnifyingglass")
                    .foregroundColor(.secondary)
                TextField("搜尋...", text: $appState.searchQuery)
                    .textFieldStyle(.plain)
                    .font(.system(size: 13, weight: .ultraLight))
            }
            .padding(10)
            .background(Color(nsColor: .controlBackgroundColor))
            .cornerRadius(8)
            .padding(.horizontal, 12)
            .padding(.top, 12)
            .padding(.bottom, 8)
            
            ScrollView {
                VStack(alignment: .leading, spacing: 4) {
                    // Main views
                    ForEach(ViewType.allCases, id: \.self) { viewType in
                        SidebarItem(
                            title: viewType.rawValue,
                            icon: viewType.icon,
                            color: viewType.color,
                            count: countForView(viewType),
                            isSelected: appState.currentView == viewType && appState.selectedTagId == nil
                        ) {
                            appState.currentView = viewType
                            appState.selectedTagId = nil
                        }
                    }
                    
                    Divider()
                        .padding(.vertical, 8)
                    
                    // Tags Section
                    HStack {
                        Text("標籤")
                            .font(.system(size: 11, weight: .medium))
                            .foregroundColor(.secondary)
                        Spacer()
                        Button(action: {}) {
                            Image(systemName: "plus")
                                .font(.system(size: 10))
                                .foregroundColor(.secondary)
                        }
                        .buttonStyle(.plain)
                    }
                    .padding(.horizontal, 12)
                    .padding(.bottom, 4)
                    
                    ForEach(appState.tags) { tag in
                        SidebarItem(
                            title: tag.name,
                            icon: "tag",
                            color: Color(hex: tag.color ?? "#6366f1"),
                            count: countForTag(tag.id),
                            isSelected: appState.selectedTagId == tag.id
                        ) {
                            appState.selectedTagId = tag.id
                        }
                    }
                }
                .padding(.vertical, 8)
            }
            
            Spacer()
            
            // User info
            HStack {
                Image(systemName: "person.circle.fill")
                    .foregroundColor(.secondary)
                Spacer()
                Button(action: { appState.logout() }) {
                    Image(systemName: "rectangle.portrait.and.arrow.right")
                        .font(.system(size: 12))
                        .foregroundColor(.secondary)
                }
                .buttonStyle(.plain)
            }
            .padding(12)
            .background(Color(nsColor: .controlBackgroundColor).opacity(0.5))
        }
        .background(Color(nsColor: .windowBackgroundColor))
    }
    
    func countForView(_ viewType: ViewType) -> Int {
        switch viewType {
        case .inbox:
            return appState.tasks.filter { $0.startDate == nil && $0.status == TaskStatus.pending && !$0.isProject && $0.parentId == nil }.count
        case .today:
            let today = Calendar.current.startOfDay(for: Date())
            return appState.tasks.filter { 
                if let startDate = $0.startDate {
                    return Calendar.current.isDate(startDate, inSameDayAs: today) && $0.status == TaskStatus.pending
                }
                return false
            }.count
        case .projects:
            return appState.tasks.filter { $0.isProject }.count
        case .logbook:
            return appState.tasks.filter { $0.status == TaskStatus.completed }.count
        default:
            return 0
        }
    }
    
    func countForTag(_ tagId: String) -> Int {
        return appState.tasks.filter { $0.tagIds.contains(tagId) && $0.status == TaskStatus.pending }.count
    }
}

struct SidebarItem: View {
    let title: String
    let icon: String
    let color: Color
    let count: Int
    let isSelected: Bool
    let action: () -> Void
    
    var body: some View {
        Button(action: action) {
            HStack(spacing: 8) {
                Image(systemName: icon)
                    .font(.system(size: 14))
                    .foregroundColor(isSelected ? .white : color)
                    .frame(width: 20)
                
                Text(title)
                    .font(.system(size: 13, weight: isSelected ? .medium : .light))
                    .foregroundColor(isSelected ? .white : .primary)
                
                Spacer()
                
                if count > 0 {
                    Text("\(count)")
                        .font(.system(size: 11, weight: .light))
                        .foregroundColor(isSelected ? .white.opacity(0.8) : .secondary)
                }
            }
            .padding(.horizontal, 12)
            .padding(.vertical, 6)
            .background(isSelected ? color : Color.clear)
            .cornerRadius(6)
        }
        .buttonStyle(.plain)
        .padding(.horizontal, 8)
    }
}

// MARK: - Main Content
struct MainContentView: View {
    @EnvironmentObject var appState: AppState
    
    var body: some View {
        VStack(spacing: 0) {
            // Header
            HStack {
                VStack(alignment: .leading, spacing: 2) {
                    Text(appState.selectedTagId != nil ? (appState.tags.first { $0.id == appState.selectedTagId }?.name ?? "") : appState.currentView.rawValue)
                        .font(.system(size: 24, weight: .light))
                    Text("\(appState.filteredTasks.count) 個任務")
                        .font(.system(size: 12, weight: .ultraLight))
                        .foregroundColor(.secondary)
                }
                
                Spacer()
                
                Button(action: { appState.showQuickAdd = true }) {
                    Image(systemName: "plus.circle.fill")
                        .font(.system(size: 24))
                        .foregroundColor(.indigo)
                }
                .buttonStyle(.plain)
                .keyboardShortcut("n", modifiers: [])
            }
            .padding(20)
            .background(Color(nsColor: .windowBackgroundColor))
            
            Divider()
            
            // Task List
            if appState.isLoading {
                Spacer()
                ProgressView()
                Spacer()
            } else if appState.filteredTasks.isEmpty {
                Spacer()
                VStack(spacing: 12) {
                    Image(systemName: "checkmark.circle")
                        .font(.system(size: 48, weight: .ultraLight))
                        .foregroundColor(.secondary.opacity(0.5))
                    Text("沒有任務")
                        .font(.system(size: 16, weight: .ultraLight))
                        .foregroundColor(.secondary)
                }
                Spacer()
            } else {
                ScrollView {
                    LazyVStack(spacing: 0) {
                        ForEach(appState.filteredTasks) { task in
                            TaskRow(task: task)
                        }
                    }
                    .padding(.vertical, 8)
                }
            }
        }
        .background(Color(nsColor: .textBackgroundColor))
    }
}

// MARK: - Task Row
struct TaskRow: View {
    @EnvironmentObject var appState: AppState
    let task: TaskItem
    @State private var isHovered = false
    
    var body: some View {
        HStack(spacing: 12) {
            // Checkbox
            Button(action: {
                AsyncTask {
                    try? await appState.toggleComplete(task.id)
                }
            }) {
                Circle()
                    .strokeBorder(Color(hex: task.color ?? "#6366f1"), lineWidth: 2)
                    .frame(width: 20, height: 20)
                    .overlay(
                        task.status == TaskStatus.completed ?
                        Image(systemName: "checkmark")
                            .font(.system(size: 10, weight: .bold))
                            .foregroundColor(Color(hex: task.color ?? "#6366f1"))
                        : nil
                    )
            }
            .buttonStyle(.plain)
            
            // Content
            VStack(alignment: .leading, spacing: 4) {
                Text(task.title)
                    .font(.system(size: 14, weight: .ultraLight))
                    .strikethrough(task.status == TaskStatus.completed)
                    .foregroundColor(task.status == TaskStatus.completed ? .secondary : .primary)
                
                if let notes = task.notes, !notes.isEmpty {
                    Text(notes)
                        .font(.system(size: 12, weight: .ultraLight))
                        .foregroundColor(.secondary)
                        .lineLimit(1)
                }
                
                // Tags
                if !task.tagIds.isEmpty {
                    HStack(spacing: 4) {
                        ForEach(task.tagIds, id: \.self) { tagId in
                            if let tag = appState.tags.first(where: { $0.id == tagId }) {
                                Text(tag.name)
                                    .font(.system(size: 10, weight: .ultraLight))
                                    .padding(.horizontal, 6)
                                    .padding(.vertical, 2)
                                    .background(Color(hex: tag.color ?? "#6366f1").opacity(0.2))
                                    .cornerRadius(4)
                            }
                        }
                    }
                }
            }
            
            Spacer()
            
            // Date
            if let startDate = task.startDate {
                Text(formatDate(startDate))
                    .font(.system(size: 11, weight: .ultraLight))
                    .foregroundColor(.secondary)
            }
            
            // Project indicator
            if task.isProject {
                Image(systemName: "folder.fill")
                    .font(.system(size: 12))
                    .foregroundColor(Color(hex: task.color ?? "#6366f1"))
            }
        }
        .padding(.horizontal, 20)
        .padding(.vertical, 10)
        .background(isHovered ? Color(nsColor: .controlBackgroundColor) : Color.clear)
        .onHover { hovering in
            isHovered = hovering
        }
        .onTapGesture {
            appState.selectedTaskId = task.id
        }
    }
    
    func formatDate(_ date: Date) -> String {
        let formatter = DateFormatter()
        formatter.dateFormat = "M/d"
        return formatter.string(from: date)
    }
}

// MARK: - Quick Add
struct QuickAddView: View {
    @EnvironmentObject var appState: AppState
    @Environment(\.dismiss) var dismiss
    @State private var title = ""
    @State private var notes = ""
    @State private var selectedColor = "#6366f1"
    @State private var isSubmitting = false
    
    let colors = ["#6366f1", "#f43f5e", "#10b981", "#f59e0b", "#3b82f6", "#8b5cf6", "#ec4899", "#64748b"]
    
    var body: some View {
        VStack(spacing: 0) {
            // Header
            HStack {
                Text("新增任務")
                    .font(.system(size: 16, weight: .medium))
                Spacer()
                Button(action: { dismiss() }) {
                    Image(systemName: "xmark.circle.fill")
                        .foregroundColor(.secondary)
                }
                .buttonStyle(.plain)
            }
            .padding()
            
            Divider()
            
            VStack(spacing: 16) {
                TextField("任務標題", text: $title)
                    .textFieldStyle(.plain)
                    .font(.system(size: 16, weight: .ultraLight))
                    .padding(12)
                    .background(Color(nsColor: .controlBackgroundColor))
                    .cornerRadius(8)
                
                TextEditor(text: $notes)
                    .font(.system(size: 14, weight: .ultraLight))
                    .frame(height: 80)
                    .padding(8)
                    .background(Color(nsColor: .controlBackgroundColor))
                    .cornerRadius(8)
                
                HStack(spacing: 8) {
                    ForEach(colors, id: \.self) { color in
                        Circle()
                            .fill(Color(hex: color))
                            .frame(width: 24, height: 24)
                            .overlay(
                                Circle()
                                    .stroke(Color.white, lineWidth: selectedColor == color ? 2 : 0)
                            )
                            .shadow(color: selectedColor == color ? Color(hex: color).opacity(0.5) : .clear, radius: 4)
                            .onTapGesture {
                                selectedColor = color
                            }
                    }
                }
            }
            .padding()
            
            Divider()
            
            HStack {
                Spacer()
                Button("取消") { dismiss() }
                Button("新增") {
                    submitTask()
                }
                .buttonStyle(.borderedProminent)
                .disabled(title.isEmpty || isSubmitting)
            }
            .padding()
        }
        .frame(width: 400)
    }
    
    func submitTask() {
        isSubmitting = true
        let newTask = TaskItem(title: title, notes: notes.isEmpty ? nil : notes, color: selectedColor, userId: appState.userId)
        AsyncTask {
            do {
                try await appState.createTask(newTask)
                await MainActor.run {
                    dismiss()
                }
            } catch {
                print("Error: \(error)")
                await MainActor.run {
                    isSubmitting = false
                }
            }
        }
    }
}

// MARK: - Login View
struct LoginView: View {
    @EnvironmentObject var appState: AppState
    @State private var email = ""
    @State private var password = ""
    @State private var isLoading = false
    @State private var errorMessage: String?
    
    var body: some View {
        VStack(spacing: 24) {
            Image(systemName: "checkmark.circle.fill")
                .font(.system(size: 64))
                .foregroundColor(.indigo)
            
            Text("Things Clone")
                .font(.system(size: 28, weight: .light))
            
            VStack(spacing: 12) {
                TextField("Email", text: $email)
                    .textFieldStyle(.roundedBorder)
                    .frame(width: 280)
                
                SecureField("密碼", text: $password)
                    .textFieldStyle(.roundedBorder)
                    .frame(width: 280)
            }
            
            if let error = errorMessage {
                Text(error)
                    .font(.system(size: 12))
                    .foregroundColor(.red)
            }
            
            Button(action: loginAction) {
                if isLoading {
                    ProgressView()
                        .scaleEffect(0.8)
                } else {
                    Text("登入")
                }
            }
            .buttonStyle(.borderedProminent)
            .disabled(email.isEmpty || password.isEmpty || isLoading)
        }
        .frame(width: 400, height: 400)
    }
    
    func loginAction() {
        isLoading = true
        errorMessage = nil
        AsyncTask {
            do {
                try await appState.login(email: email, password: password)
            } catch let error as NSError {
                await MainActor.run {
                    isLoading = false
                    errorMessage = error.localizedDescription
                }
            } catch {
                await MainActor.run {
                    isLoading = false
                    errorMessage = "登入失敗: \(error.localizedDescription)"
                }
            }
        }
    }
}

// MARK: - Settings View
struct SettingsView: View {
    var body: some View {
        Text("設定")
            .frame(width: 400, height: 300)
    }
}

// MARK: - Color Extension
extension Color {
    init(hex: String) {
        let hex = hex.trimmingCharacters(in: CharacterSet.alphanumerics.inverted)
        var int: UInt64 = 0
        Scanner(string: hex).scanHexInt64(&int)
        let a, r, g, b: UInt64
        switch hex.count {
        case 3:
            (a, r, g, b) = (255, (int >> 8) * 17, (int >> 4 & 0xF) * 17, (int & 0xF) * 17)
        case 6:
            (a, r, g, b) = (255, int >> 16, int >> 8 & 0xFF, int & 0xFF)
        case 8:
            (a, r, g, b) = (int >> 24, int >> 16 & 0xFF, int >> 8 & 0xFF, int & 0xFF)
        default:
            (a, r, g, b) = (255, 0, 0, 0)
        }
        self.init(.sRGB, red: Double(r) / 255, green: Double(g) / 255, blue: Double(b) / 255, opacity: Double(a) / 255)
    }
}

#Preview {
    ContentView()
        .environmentObject(AppState())
}
