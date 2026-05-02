import 'package:flutter/material.dart';
import '../../services/api_service.dart';
import 'package:flutter_secure_storage/flutter_secure_storage.dart';
import 'package:hive_flutter/hive_flutter.dart';

class AuthProvider extends ChangeNotifier {
  final ApiService _api = ApiService();
  final _storage = const FlutterSecureStorage();
  
  Map<String, dynamic>? _user;
  bool _isLoading = true;

  Map<String, dynamic>? get user => _user;
  bool get isLoading => _isLoading;
  bool get isAuthenticated => _user != null;

  AuthProvider() {
    _initHive().then((_) => checkAuth());
  }

  Future<void> _initHive() async {
    // Hive is already initialized in main/OfflineService, but we need the box
    await Hive.openBox('auth_cache');
  }

  Future<void> checkAuth() async {
    _isLoading = true;
    notifyListeners();
    
    // Load from cache first
    final box = Hive.box('auth_cache');
    final cachedUser = box.get('user');
    if (cachedUser != null) {
      _user = Map<String, dynamic>.from(cachedUser as Map);
    }

    try {
      final res = await _api.get('/auth?action=me');
      _user = res;
      // Save to cache
      await box.put('user', _user);
    } catch (e) {
      // If offline, keep the cached user. 
      // Only clear if we get a definitive 401/Unauthorized (not implemented here, but typically)
      // For now, if we have a token but API fails, we assume connectivity issues
      final token = await _storage.read(key: 'auth_token');
      if (token == null) {
        _user = null;
        await box.delete('user');
      }
    } finally {
      _isLoading = false;
      notifyListeners();
    }
  }

  void updateLocalUser(Map<String, dynamic> newData) {
    if (_user != null) {
      _user!.addAll(newData);
      Hive.box('auth_cache').put('user', _user);
      notifyListeners();
    }
  }

  Future<void> login(String email, String password) async {
    final res = await _api.post('/auth?action=login', {'email': email, 'password': password});
    await _storage.write(key: 'auth_token', value: res['token']);
    _user = res['user'];
    notifyListeners();
  }

  Future<void> register(Map<String, dynamic> data) async {
    final res = await _api.post('/auth?action=register-farmer', data);
    await _storage.write(key: 'auth_token', value: res['token']);
    _user = res['user'];
    notifyListeners();
  }

  Future<void> logout() async {
    await _storage.delete(key: 'auth_token');
    _user = null;
    notifyListeners();
  }
}
