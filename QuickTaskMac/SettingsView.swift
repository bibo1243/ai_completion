import SwiftUI

struct SettingsView: View {
    @State private var email: String = ""
    @State private var password: String = ""
    @State private var isLoggingIn = false
    @State private var errorMessage: String? = nil
    @State private var isLoggedIn = SupabaseService.shared.isLoggedIn
    @State private var supabaseUrl: String = UserDefaults.standard.string(forKey: "supabase_url") ?? ""
    @State private var supabaseKey: String = UserDefaults.standard.string(forKey: "supabase_key") ?? ""
    
    var body: some View {
        VStack(spacing: 20) {
            // Header
            HStack {
                Image(systemName: "gear")
                    .font(.system(size: 24))
                Text("設定")
                    .font(.title2.bold())
            }
            .padding(.top)
            
            Divider()
            
            // Supabase Configuration
            GroupBox(label: Label("Supabase 設定", systemImage: "server.rack")) {
                VStack(alignment: .leading, spacing: 12) {
                    VStack(alignment: .leading, spacing: 4) {
                        Text("Supabase URL")
                            .font(.caption)
                            .foregroundColor(.secondary)
                        TextField("https://xxx.supabase.co", text: $supabaseUrl)
                            .textFieldStyle(.roundedBorder)
                    }
                    
                    VStack(alignment: .leading, spacing: 4) {
                        Text("Anon Key")
                            .font(.caption)
                            .foregroundColor(.secondary)
                        SecureField("eyJhbGciOiJIUzI1NiIs...", text: $supabaseKey)
                            .textFieldStyle(.roundedBorder)
                    }
                    
                    Button("儲存設定") {
                        UserDefaults.standard.set(supabaseUrl, forKey: "supabase_url")
                        UserDefaults.standard.set(supabaseKey, forKey: "supabase_key")
                    }
                    .buttonStyle(.borderedProminent)
                }
                .padding(.vertical, 8)
            }
            
            // Login Section
            GroupBox(label: Label("帳號登入", systemImage: "person.circle")) {
                if isLoggedIn {
                    VStack(spacing: 12) {
                        HStack {
                            Image(systemName: "checkmark.circle.fill")
                                .foregroundColor(.green)
                            Text("已登入")
                                .foregroundColor(.green)
                        }
                        
                        Button("登出") {
                            SupabaseService.shared.logout()
                            isLoggedIn = false
                        }
                        .buttonStyle(.bordered)
                    }
                    .padding(.vertical, 8)
                } else {
                    VStack(alignment: .leading, spacing: 12) {
                        VStack(alignment: .leading, spacing: 4) {
                            Text("Email")
                                .font(.caption)
                                .foregroundColor(.secondary)
                            TextField("your@email.com", text: $email)
                                .textFieldStyle(.roundedBorder)
                        }
                        
                        VStack(alignment: .leading, spacing: 4) {
                            Text("密碼")
                                .font(.caption)
                                .foregroundColor(.secondary)
                            SecureField("密碼", text: $password)
                                .textFieldStyle(.roundedBorder)
                        }
                        
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
                                Text("登入")
                            }
                        }
                        .buttonStyle(.borderedProminent)
                        .disabled(email.isEmpty || password.isEmpty || isLoggingIn)
                    }
                    .padding(.vertical, 8)
                }
            }
            
            // Instructions
            GroupBox(label: Label("使用說明", systemImage: "keyboard")) {
                VStack(alignment: .leading, spacing: 8) {
                    HStack {
                        Text("⌘⇧I")
                            .font(.system(.body, design: .monospaced))
                            .padding(.horizontal, 8)
                            .padding(.vertical, 4)
                            .background(Color.gray.opacity(0.2))
                            .cornerRadius(6)
                        Text("開啟快速輸入視窗")
                    }
                    
                    HStack {
                        Text("⌘↵")
                            .font(.system(.body, design: .monospaced))
                            .padding(.horizontal, 8)
                            .padding(.vertical, 4)
                            .background(Color.gray.opacity(0.2))
                            .cornerRadius(6)
                        Text("新增任務")
                    }
                    
                    HStack {
                        Text("ESC")
                            .font(.system(.body, design: .monospaced))
                            .padding(.horizontal, 8)
                            .padding(.vertical, 4)
                            .background(Color.gray.opacity(0.2))
                            .cornerRadius(6)
                        Text("關閉視窗")
                    }
                }
                .padding(.vertical, 8)
            }
            
            Spacer()
            
            Text("Quick Task v1.0")
                .font(.caption)
                .foregroundColor(.secondary)
        }
        .padding()
        .frame(width: 400, height: 600)
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
                    errorMessage = error.localizedDescription
                }
            }
        }
    }
}

#Preview {
    SettingsView()
}
