import Foundation

class SupabaseService {
    static let shared = SupabaseService()
    
    // IMPORTANT: Replace these with your actual Supabase credentials
    private let supabaseUrl = "YOUR_SUPABASE_URL"
    private let supabaseKey = "YOUR_SUPABASE_ANON_KEY"
    
    private init() {}
    
    struct TaskPayload: Codable {
        let title: String
        let notes: String?
        let color: String?
        let start_date: String?
        let due_date: String?
        let status: String
        let user_id: String
        let created_at: String
    }
    
    func createTask(title: String, notes: String, color: String, startDate: Date?, dueDate: Date?) async throws {
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
        dateFormatter.formatOptions = [.withInternetDateTime]
        
        // Get user ID from stored session or use a default
        let userId = UserDefaults.standard.string(forKey: "supabase_user_id") ?? ""
        
        if userId.isEmpty {
            throw NSError(domain: "SupabaseService", code: 401, userInfo: [NSLocalizedDescriptionKey: "請先在設定中登入"])
        }
        
        let payload = TaskPayload(
            title: title,
            notes: notes.isEmpty ? nil : notes,
            color: color,
            start_date: startDate.map { dateFormatter.string(from: $0) },
            due_date: dueDate.map { dateFormatter.string(from: $0) },
            status: "pending",
            user_id: userId,
            created_at: dateFormatter.string(from: Date())
        )
        
        let encoder = JSONEncoder()
        request.httpBody = try encoder.encode(payload)
        
        let (_, response) = try await URLSession.shared.data(for: request)
        
        guard let httpResponse = response as? HTTPURLResponse else {
            throw URLError(.badServerResponse)
        }
        
        guard (200...299).contains(httpResponse.statusCode) else {
            throw NSError(domain: "SupabaseService", code: httpResponse.statusCode, 
                         userInfo: [NSLocalizedDescriptionKey: "伺服器回應錯誤: \(httpResponse.statusCode)"])
        }
    }
    
    // Login function
    func login(email: String, password: String) async throws -> String {
        guard let url = URL(string: "\(supabaseUrl)/auth/v1/token?grant_type=password") else {
            throw URLError(.badURL)
        }
        
        var request = URLRequest(url: url)
        request.httpMethod = "POST"
        request.setValue("application/json", forHTTPHeaderField: "Content-Type")
        request.setValue(supabaseKey, forHTTPHeaderField: "apikey")
        
        let loginPayload = ["email": email, "password": password]
        request.httpBody = try JSONEncoder().encode(loginPayload)
        
        let (data, response) = try await URLSession.shared.data(for: request)
        
        guard let httpResponse = response as? HTTPURLResponse,
              (200...299).contains(httpResponse.statusCode) else {
            throw NSError(domain: "SupabaseService", code: 401, userInfo: [NSLocalizedDescriptionKey: "登入失敗"])
        }
        
        struct LoginResponse: Codable {
            let access_token: String
            let user: User
            
            struct User: Codable {
                let id: String
            }
        }
        
        let loginResponse = try JSONDecoder().decode(LoginResponse.self, from: data)
        
        // Store user ID
        UserDefaults.standard.set(loginResponse.user.id, forKey: "supabase_user_id")
        UserDefaults.standard.set(loginResponse.access_token, forKey: "supabase_access_token")
        
        return loginResponse.user.id
    }
    
    var isLoggedIn: Bool {
        return UserDefaults.standard.string(forKey: "supabase_user_id") != nil
    }
    
    func logout() {
        UserDefaults.standard.removeObject(forKey: "supabase_user_id")
        UserDefaults.standard.removeObject(forKey: "supabase_access_token")
    }
}
