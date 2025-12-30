import SwiftUI
import Combine

// MARK: - Models
struct Task: Identifiable, Codable {
    let id: String
    var title: String
    var notes: String?
    var status: TaskStatus
    var color: String?
    var startDate: Date?
    var dueDate: Date?
    var completedAt: Date?
    var isProject: Bool
    var parentId: String?
    var tagIds: [String]
    var createdAt: Date
    var userId: String
    
    init(id: String = UUID().uuidString, title: String, notes: String? = nil, status: TaskStatus = .pending, color: String? = "#6366f1", startDate: Date? = nil, dueDate: Date? = nil, completedAt: Date? = nil, isProject: Bool = false, parentId: String? = nil, tagIds: [String] = [], createdAt: Date = Date(), userId: String = "") {
        self.id = id
        self.title = title
        self.notes = notes
        self.status = status
        self.color = color
        self.startDate = startDate
        self.dueDate = dueDate
        self.completedAt = completedAt
        self.isProject = isProject
        self.parentId = parentId
        self.tagIds = tagIds
        self.createdAt = createdAt
        self.userId = userId
    }
}

enum TaskStatus: String, Codable {
    case pending
    case completed
    case archived
}

struct Tag: Identifiable, Codable {
    let id: String
    var name: String
    var color: String?
    var userId: String
    
    init(id: String = UUID().uuidString, name: String, color: String? = nil, userId: String = "") {
        self.id = id
        self.name = name
        self.color = color
        self.userId = userId
    }
}

// MARK: - View Types
enum ViewType: String, CaseIterable {
    case inbox = "收件匣"
    case today = "今天"
    case upcoming = "預定"
    case anytime = "稍後"
    case projects = "專案"
    case logbook = "紀錄本"
    case journal = "日記"
    case focus = "專注"
    case calendar = "行事曆"
    
    var icon: String {
        switch self {
        case .inbox: return "tray"
        case .today: return "star"
        case .upcoming: return "calendar"
        case .anytime: return "archivebox"
        case .projects: return "folder"
        case .logbook: return "book.closed"
        case .journal: return "book"
        case .focus: return "scope"
        case .calendar: return "calendar.day.timeline.left"
        }
    }
    
    var color: Color {
        switch self {
        case .inbox: return .blue
        case .today: return .yellow
        case .upcoming: return .red
        case .anytime: return .cyan
        case .projects: return .purple
        case .logbook: return .green
        case .journal: return .orange
        case .focus: return .indigo
        case .calendar: return .pink
        }
    }
}

// MARK: - App State
class AppState: ObservableObject {
    @Published var currentView: ViewType = .inbox
    @Published var selectedTagId: String? = nil
    @Published var tasks: [Task] = []
    @Published var tags: [Tag] = []
    @Published var selectedTaskId: String? = nil
    @Published var showQuickAdd: Bool = false
    @Published var isLoggedIn: Bool = false
    @Published var userId: String = ""
    @Published var isLoading: Bool = false
    @Published var searchQuery: String = ""
    
    private let supabase = SupabaseService.shared
    
    init() {
        checkAuth()
    }
    
    func checkAuth() {
        if let userId = UserDefaults.standard.string(forKey: "supabase_user_id") {
            self.userId = userId
            self.isLoggedIn = true
            loadData()
        }
    }
    
    func login(email: String, password: String) async throws {
        let userId = try await supabase.login(email: email, password: password)
        await MainActor.run {
            self.userId = userId
            self.isLoggedIn = true
            loadData()
        }
    }
    
    func logout() {
        supabase.logout()
        userId = ""
        isLoggedIn = false
        tasks = []
        tags = []
    }
    
    func loadData() {
        isLoading = true
        Task {
            do {
                let fetchedTasks = try await supabase.fetchTasks()
                let fetchedTags = try await supabase.fetchTags()
                await MainActor.run {
                    self.tasks = fetchedTasks
                    self.tags = fetchedTags
                    self.isLoading = false
                }
            } catch {
                print("Error loading data: \(error)")
                await MainActor.run {
                    self.isLoading = false
                }
            }
        }
    }
    
    func createTask(_ task: Task) async throws {
        try await supabase.createTask(task)
        loadData()
    }
    
    func updateTask(_ task: Task) async throws {
        try await supabase.updateTask(task)
        loadData()
    }
    
    func deleteTask(_ taskId: String) async throws {
        try await supabase.deleteTask(taskId)
        loadData()
    }
    
    func toggleComplete(_ taskId: String) async throws {
        if var task = tasks.first(where: { $0.id == taskId }) {
            if task.status == .completed {
                task.status = .pending
                task.completedAt = nil
            } else {
                task.status = .completed
                task.completedAt = Date()
            }
            try await updateTask(task)
        }
    }
    
    // Filtered tasks for current view
    var filteredTasks: [Task] {
        var result = tasks.filter { $0.status != .archived }
        
        // Filter by search
        if !searchQuery.isEmpty {
            result = result.filter { $0.title.localizedCaseInsensitiveContains(searchQuery) }
        }
        
        // Filter by tag
        if let tagId = selectedTagId {
            result = result.filter { $0.tagIds.contains(tagId) }
            return result
        }
        
        switch currentView {
        case .inbox:
            return result.filter { $0.startDate == nil && $0.status == .pending && !$0.isProject && $0.parentId == nil }
        case .today:
            let today = Calendar.current.startOfDay(for: Date())
            return result.filter { 
                if let startDate = $0.startDate {
                    return Calendar.current.isDate(startDate, inSameDayAs: today) && $0.status == .pending
                }
                return false
            }
        case .upcoming:
            let today = Calendar.current.startOfDay(for: Date())
            return result.filter {
                if let startDate = $0.startDate {
                    return startDate > today && $0.status == .pending
                }
                return false
            }
        case .anytime:
            return result.filter { $0.startDate != nil && $0.status == .pending }
        case .projects:
            return result.filter { $0.isProject }
        case .logbook:
            return tasks.filter { $0.status == .completed }
        case .journal, .focus, .calendar:
            return result.filter { $0.status == .pending }
        }
    }
}

// MARK: - Supabase Service Extension
extension SupabaseService {
    func fetchTasks() async throws -> [Task] {
        guard let url = URL(string: "\(supabaseUrl)/rest/v1/tasks?select=*&order=created_at.desc") else {
            throw URLError(.badURL)
        }
        
        var request = URLRequest(url: url)
        request.setValue("application/json", forHTTPHeaderField: "Content-Type")
        request.setValue(supabaseKey, forHTTPHeaderField: "apikey")
        request.setValue("Bearer \(supabaseKey)", forHTTPHeaderField: "Authorization")
        
        let (data, _) = try await URLSession.shared.data(for: request)
        
        struct TaskResponse: Codable {
            let id: String
            let title: String
            let notes: String?
            let status: String
            let color: String?
            let start_date: String?
            let due_date: String?
            let completed_at: String?
            let is_project: Bool?
            let parent_id: String?
            let tag_ids: [String]?
            let created_at: String
            let user_id: String
        }
        
        let responses = try JSONDecoder().decode([TaskResponse].self, from: data)
        let dateFormatter = ISO8601DateFormatter()
        
        return responses.map { r in
            Task(
                id: r.id,
                title: r.title,
                notes: r.notes,
                status: TaskStatus(rawValue: r.status) ?? .pending,
                color: r.color,
                startDate: r.start_date.flatMap { dateFormatter.date(from: $0) },
                dueDate: r.due_date.flatMap { dateFormatter.date(from: $0) },
                completedAt: r.completed_at.flatMap { dateFormatter.date(from: $0) },
                isProject: r.is_project ?? false,
                parentId: r.parent_id,
                tagIds: r.tag_ids ?? [],
                createdAt: dateFormatter.date(from: r.created_at) ?? Date(),
                userId: r.user_id
            )
        }
    }
    
    func fetchTags() async throws -> [Tag] {
        guard let url = URL(string: "\(supabaseUrl)/rest/v1/tags?select=*") else {
            throw URLError(.badURL)
        }
        
        var request = URLRequest(url: url)
        request.setValue("application/json", forHTTPHeaderField: "Content-Type")
        request.setValue(supabaseKey, forHTTPHeaderField: "apikey")
        request.setValue("Bearer \(supabaseKey)", forHTTPHeaderField: "Authorization")
        
        let (data, _) = try await URLSession.shared.data(for: request)
        
        struct TagResponse: Codable {
            let id: String
            let name: String
            let color: String?
            let user_id: String
        }
        
        let responses = try JSONDecoder().decode([TagResponse].self, from: data)
        return responses.map { Tag(id: $0.id, name: $0.name, color: $0.color, userId: $0.user_id) }
    }
    
    func createTask(_ task: Task) async throws {
        guard let url = URL(string: "\(supabaseUrl)/rest/v1/tasks") else {
            throw URLError(.badURL)
        }
        
        var request = URLRequest(url: url)
        request.httpMethod = "POST"
        request.setValue("application/json", forHTTPHeaderField: "Content-Type")
        request.setValue(supabaseKey, forHTTPHeaderField: "apikey")
        request.setValue("Bearer \(supabaseKey)", forHTTPHeaderField: "Authorization")
        request.setValue("return=minimal", forHTTPHeaderField: "Prefer")
        
        let dateFormatter = ISO8601DateFormatter()
        let userId = UserDefaults.standard.string(forKey: "supabase_user_id") ?? ""
        
        let payload: [String: Any?] = [
            "title": task.title,
            "notes": task.notes,
            "status": task.status.rawValue,
            "color": task.color,
            "start_date": task.startDate.map { dateFormatter.string(from: $0) },
            "due_date": task.dueDate.map { dateFormatter.string(from: $0) },
            "is_project": task.isProject,
            "parent_id": task.parentId,
            "tag_ids": task.tagIds,
            "user_id": userId
        ]
        
        request.httpBody = try JSONSerialization.data(withJSONObject: payload.compactMapValues { $0 })
        
        let (_, response) = try await URLSession.shared.data(for: request)
        guard let httpResponse = response as? HTTPURLResponse, (200...299).contains(httpResponse.statusCode) else {
            throw URLError(.badServerResponse)
        }
    }
    
    func updateTask(_ task: Task) async throws {
        guard let url = URL(string: "\(supabaseUrl)/rest/v1/tasks?id=eq.\(task.id)") else {
            throw URLError(.badURL)
        }
        
        var request = URLRequest(url: url)
        request.httpMethod = "PATCH"
        request.setValue("application/json", forHTTPHeaderField: "Content-Type")
        request.setValue(supabaseKey, forHTTPHeaderField: "apikey")
        request.setValue("Bearer \(supabaseKey)", forHTTPHeaderField: "Authorization")
        
        let dateFormatter = ISO8601DateFormatter()
        
        let payload: [String: Any?] = [
            "title": task.title,
            "notes": task.notes,
            "status": task.status.rawValue,
            "color": task.color,
            "start_date": task.startDate.map { dateFormatter.string(from: $0) },
            "due_date": task.dueDate.map { dateFormatter.string(from: $0) },
            "completed_at": task.completedAt.map { dateFormatter.string(from: $0) },
            "is_project": task.isProject,
            "tag_ids": task.tagIds
        ]
        
        request.httpBody = try JSONSerialization.data(withJSONObject: payload.compactMapValues { $0 })
        
        let (_, response) = try await URLSession.shared.data(for: request)
        guard let httpResponse = response as? HTTPURLResponse, (200...299).contains(httpResponse.statusCode) else {
            throw URLError(.badServerResponse)
        }
    }
    
    func deleteTask(_ taskId: String) async throws {
        guard let url = URL(string: "\(supabaseUrl)/rest/v1/tasks?id=eq.\(taskId)") else {
            throw URLError(.badURL)
        }
        
        var request = URLRequest(url: url)
        request.httpMethod = "DELETE"
        request.setValue(supabaseKey, forHTTPHeaderField: "apikey")
        request.setValue("Bearer \(supabaseKey)", forHTTPHeaderField: "Authorization")
        
        let (_, response) = try await URLSession.shared.data(for: request)
        guard let httpResponse = response as? HTTPURLResponse, (200...299).contains(httpResponse.statusCode) else {
            throw URLError(.badServerResponse)
        }
    }
    
    var supabaseUrl: String { "https://acrkclmderqewcwugsnl.supabase.co" }
    var supabaseKey: String { "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImFjcmtjbG1kZXJxZXdjd3Vnc25sIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjYyNTc0MzAsImV4cCI6MjA4MTgzMzQzMH0.UT2vJTXpPO5tR9sUD8YU0gJ_47Zpe3yJiLzllUljPDw" }
}
