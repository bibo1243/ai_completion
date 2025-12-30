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
        
        print("🔐 嘗試登入: \(email)")
        
        let (data, response) = try await URLSession.shared.data(for: request)
        
        guard let httpResponse = response as? HTTPURLResponse else {
            throw NSError(domain: "SupabaseService", code: -1, userInfo: [NSLocalizedDescriptionKey: "無效的回應"])
        }
        
        print("📡 HTTP 狀態碼: \(httpResponse.statusCode)")
        
        if let responseString = String(data: data, encoding: .utf8) {
            print("📝 回應內容: \(responseString)")
        }
        
        guard (200...299).contains(httpResponse.statusCode) else {
            // Try to parse error message from response
            if let errorData = try? JSONSerialization.jsonObject(with: data) as? [String: Any],
               let errorMessage = errorData["error_description"] as? String ?? errorData["msg"] as? String ?? errorData["message"] as? String {
                throw NSError(domain: "SupabaseService", code: httpResponse.statusCode, userInfo: [NSLocalizedDescriptionKey: errorMessage])
            }
            throw NSError(domain: "SupabaseService", code: httpResponse.statusCode, userInfo: [NSLocalizedDescriptionKey: "登入失敗 (狀態碼: \(httpResponse.statusCode))"])
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
        
        print("✅ 登入成功! User ID: \(loginResponse.user.id)")
        
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
