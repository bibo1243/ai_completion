import SwiftUI

// MARK: - Task Detail View (編輯任務面板)
struct TaskDetailView: View {
    @EnvironmentObject var appState: AppState
    @Environment(\.dismiss) var dismiss
    
    let taskId: String
    
    @State private var title: String = ""
    @State private var notes: String = ""
    @State private var selectedColor: String = "#6366f1"
    @State private var startDate: Date? = nil
    @State private var dueDate: Date? = nil
    @State private var selectedTagIds: Set<String> = []
    @State private var isProject: Bool = false
    @State private var showStartDatePicker = false
    @State private var showDueDatePicker = false
    @State private var isSaving = false
    @State private var showDeleteConfirm = false
    
    let colors = ["#6366f1", "#f43f5e", "#10b981", "#f59e0b", "#3b82f6", "#8b5cf6", "#ec4899", "#64748b"]
    
    var task: TaskItem? {
        appState.tasks.first { $0.id == taskId }
    }
    
    var body: some View {
        VStack(spacing: 0) {
            // Header
            HStack {
                Circle()
                    .fill(Color(hex: selectedColor))
                    .frame(width: 12, height: 12)
                
                Text("編輯任務")
                    .font(.system(size: 16, weight: .medium))
                
                Spacer()
                
                Button(action: { dismiss() }) {
                    Image(systemName: "xmark.circle.fill")
                        .font(.system(size: 20))
                        .foregroundColor(.secondary)
                }
                .buttonStyle(.plain)
            }
            .padding()
            
            Divider()
            
            ScrollView {
                VStack(alignment: .leading, spacing: 20) {
                    // Title
                    VStack(alignment: .leading, spacing: 6) {
                        Text("標題")
                            .font(.system(size: 12, weight: .light))
                            .foregroundColor(.secondary)
                        
                        TextField("任務標題", text: $title)
                            .textFieldStyle(.plain)
                            .font(.system(size: 18, weight: .ultraLight))
                            .padding(12)
                            .background(Color(nsColor: .controlBackgroundColor))
                            .cornerRadius(8)
                    }
                    
                    // Notes
                    VStack(alignment: .leading, spacing: 6) {
                        Text("備註")
                            .font(.system(size: 12, weight: .light))
                            .foregroundColor(.secondary)
                        
                        TextEditor(text: $notes)
                            .font(.system(size: 14, weight: .ultraLight))
                            .frame(minHeight: 100, maxHeight: 200)
                            .padding(8)
                            .background(Color(nsColor: .controlBackgroundColor))
                            .cornerRadius(8)
                    }
                    
                    // Color picker
                    VStack(alignment: .leading, spacing: 6) {
                        Text("顏色")
                            .font(.system(size: 12, weight: .light))
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
                    HStack(spacing: 20) {
                        // Start Date
                        VStack(alignment: .leading, spacing: 6) {
                            Text("開始日期")
                                .font(.system(size: 12, weight: .light))
                                .foregroundColor(.secondary)
                            
                            HStack {
                                DatePicker(
                                    "",
                                    selection: Binding(
                                        get: { startDate ?? Date() },
                                        set: { startDate = $0 }
                                    ),
                                    displayedComponents: [.date]
                                )
                                .labelsHidden()
                                .disabled(startDate == nil)
                                
                                Toggle("", isOn: Binding(
                                    get: { startDate != nil },
                                    set: { if $0 { startDate = Date() } else { startDate = nil } }
                                ))
                                .toggleStyle(.switch)
                                .labelsHidden()
                            }
                        }
                        
                        // Due Date
                        VStack(alignment: .leading, spacing: 6) {
                            Text("截止日期")
                                .font(.system(size: 12, weight: .light))
                                .foregroundColor(.secondary)
                            
                            HStack {
                                DatePicker(
                                    "",
                                    selection: Binding(
                                        get: { dueDate ?? Date() },
                                        set: { dueDate = $0 }
                                    ),
                                    displayedComponents: [.date]
                                )
                                .labelsHidden()
                                .disabled(dueDate == nil)
                                
                                Toggle("", isOn: Binding(
                                    get: { dueDate != nil },
                                    set: { if $0 { dueDate = Date() } else { dueDate = nil } }
                                ))
                                .toggleStyle(.switch)
                                .labelsHidden()
                            }
                        }
                    }
                    
                    // Tags
                    VStack(alignment: .leading, spacing: 6) {
                        Text("標籤")
                            .font(.system(size: 12, weight: .light))
                            .foregroundColor(.secondary)
                        
                        if appState.tags.isEmpty {
                            Text("沒有可用的標籤")
                                .font(.system(size: 12, weight: .ultraLight))
                                .foregroundColor(.secondary)
                        } else {
                            FlowLayout(spacing: 8) {
                                ForEach(appState.tags) { tag in
                                    TagChip(
                                        tag: tag,
                                        isSelected: selectedTagIds.contains(tag.id),
                                        action: {
                                            if selectedTagIds.contains(tag.id) {
                                                selectedTagIds.remove(tag.id)
                                            } else {
                                                selectedTagIds.insert(tag.id)
                                            }
                                        }
                                    )
                                }
                            }
                        }
                    }
                    
                    // Project toggle
                    Toggle(isOn: $isProject) {
                        HStack {
                            Image(systemName: "folder")
                                .foregroundColor(.purple)
                            Text("設為專案")
                                .font(.system(size: 14, weight: .light))
                        }
                    }
                    .toggleStyle(.switch)
                    
                    Divider()
                    
                    // Delete button
                    Button(action: { showDeleteConfirm = true }) {
                        HStack {
                            Image(systemName: "trash")
                            Text("刪除任務")
                        }
                        .font(.system(size: 14, weight: .light))
                        .foregroundColor(.red)
                    }
                    .buttonStyle(.plain)
                }
                .padding(20)
            }
            
            Divider()
            
            // Footer
            HStack {
                Button("取消") {
                    dismiss()
                }
                .keyboardShortcut(.escape, modifiers: [])
                
                Spacer()
                
                Button(action: saveTask) {
                    HStack {
                        if isSaving {
                            ProgressView()
                                .scaleEffect(0.7)
                        }
                        Text("儲存")
                    }
                    .frame(minWidth: 80)
                }
                .buttonStyle(.borderedProminent)
                .disabled(title.isEmpty || isSaving)
                .keyboardShortcut(.return, modifiers: .command)
            }
            .padding()
        }
        .frame(width: 450, height: 650)
        .onAppear {
            loadTaskData()
        }
        .alert("確定要刪除任務？", isPresented: $showDeleteConfirm) {
            Button("取消", role: .cancel) {}
            Button("刪除", role: .destructive) {
                deleteTask()
            }
        } message: {
            Text("此操作無法復原")
        }
    }
    
    func loadTaskData() {
        guard let task = task else { return }
        title = task.title
        notes = task.notes ?? ""
        selectedColor = task.color ?? "#6366f1"
        startDate = task.startDate
        dueDate = task.dueDate
        selectedTagIds = Set(task.tagIds)
        isProject = task.isProject
    }
    
    func saveTask() {
        guard let task = task else { return }
        
        isSaving = true
        
        var updatedTask = task
        updatedTask.title = title
        updatedTask.notes = notes.isEmpty ? nil : notes
        updatedTask.color = selectedColor
        updatedTask.startDate = startDate
        updatedTask.dueDate = dueDate
        updatedTask.tagIds = Array(selectedTagIds)
        updatedTask.isProject = isProject
        
        AsyncTask {
            do {
                try await appState.updateTask(updatedTask)
                await MainActor.run {
                    isSaving = false
                    dismiss()
                }
            } catch {
                print("Error saving: \(error)")
                await MainActor.run {
                    isSaving = false
                }
            }
        }
    }
    
    func deleteTask() {
        AsyncTask {
            do {
                try await appState.deleteTask(taskId)
                await MainActor.run {
                    dismiss()
                }
            } catch {
                print("Error deleting: \(error)")
            }
        }
    }
}

// MARK: - Tag Chip
struct TagChip: View {
    let tag: Tag
    let isSelected: Bool
    let action: () -> Void
    
    var body: some View {
        Button(action: action) {
            HStack(spacing: 4) {
                Image(systemName: "tag")
                    .font(.system(size: 10))
                Text(tag.name)
                    .font(.system(size: 12, weight: .light))
            }
            .padding(.horizontal, 10)
            .padding(.vertical, 6)
            .background(isSelected ? Color(hex: tag.color ?? "#6366f1") : Color(hex: tag.color ?? "#6366f1").opacity(0.15))
            .foregroundColor(isSelected ? .white : Color(hex: tag.color ?? "#6366f1"))
            .cornerRadius(16)
        }
        .buttonStyle(.plain)
    }
}

// MARK: - Flow Layout (for tags)
struct FlowLayout: Layout {
    var spacing: CGFloat = 8
    
    func sizeThatFits(proposal: ProposedViewSize, subviews: Subviews, cache: inout ()) -> CGSize {
        let result = FlowResult(in: proposal.width ?? 0, subviews: subviews, spacing: spacing)
        return result.size
    }
    
    func placeSubviews(in bounds: CGRect, proposal: ProposedViewSize, subviews: Subviews, cache: inout ()) {
        let result = FlowResult(in: bounds.width, subviews: subviews, spacing: spacing)
        for (index, subview) in subviews.enumerated() {
            subview.place(at: CGPoint(x: bounds.minX + result.positions[index].x, y: bounds.minY + result.positions[index].y), proposal: .unspecified)
        }
    }
    
    struct FlowResult {
        var size: CGSize = .zero
        var positions: [CGPoint] = []
        
        init(in width: CGFloat, subviews: Subviews, spacing: CGFloat) {
            var x: CGFloat = 0
            var y: CGFloat = 0
            var lineHeight: CGFloat = 0
            
            for subview in subviews {
                let size = subview.sizeThatFits(.unspecified)
                
                if x + size.width > width && x > 0 {
                    x = 0
                    y += lineHeight + spacing
                    lineHeight = 0
                }
                
                positions.append(CGPoint(x: x, y: y))
                lineHeight = max(lineHeight, size.height)
                x += size.width + spacing
            }
            
            self.size = CGSize(width: width, height: y + lineHeight)
        }
    }
}
