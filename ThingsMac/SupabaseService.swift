import Foundation

class SupabaseService {
    static let shared = SupabaseService()
    
    private init() {}
    
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
    
    var supabaseUrl: String { "https://acrkclmderqewcwugsnl.supabase.co" }
    var supabaseKey: String { "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImFjcmtjbG1kZXJxZXdjd3Vnc25sIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjYyNTc0MzAsImV4cCI6MjA4MTgzMzQzMH0.UT2vJTXpPO5tR9sUD8YU0gJ_47Zpe3yJiLzllUljPDw" }
}
