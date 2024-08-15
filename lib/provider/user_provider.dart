import 'dart:convert';
import 'dart:developer';

import 'package:flutter/material.dart';
import 'package:socket_io_client/socket_io_client.dart' as IO;

import 'package:finity/features/home/services/location_service.dart';
import 'package:finity/models/user_model.dart';

class UserProvider extends ChangeNotifier {
  UserModel _user = UserModel(
    id: '',
    name: '',
    email: '',
    token: '',
    address: '',
    password: '',
    location: [],
    itemsListed: [],
    events: [],
    notifications: [],
    itemsLended: [],
    itemsBorrowed: [],
    itemsRequested: [],
  );

  late IO.Socket _socket;

  UserProvider() {
    _initializeSocket();
  }

  UserModel get user => _user;

  void _initializeSocket() {
    log('Initializing socket connection...');
    _socket = IO.io("http://192.168.29.160:3001", <String, dynamic>{
      'transports': ['websocket'],
      'autoConnect': true,
    });

    _socket.on('connect', (_) {
      log('Connected to socket server');
      _listenForUserUpdates();
    });

    _socket.on('disconnect', (_) {
      log('Disconnected from socket server');
    });

    _socket.on('connect_error', (error) {
      log('Connection error: $error');
    });

    _socket.on('error', (error) {
      log('Socket error: $error');
    });
  }

  void _listenForUserUpdates() {
    log('Setting up listener for user updates...');
    _socket.on('user_update_${_user.id}', (data) {
      log('Received update for user ${_user.id}: $data');
      final updatedUserMap = jsonDecode(data);
      _user = UserModel.fromJson(updatedUserMap);
      log('User updated: ID=${_user.id}, Name=${_user.name}');
      notifyListeners();
    });
  }

  void setUser(String userJson) {
    log('Setting user from JSON: $userJson');
    final userMap = jsonDecode(userJson);
    _user = UserModel.fromJson(userMap);
    log('User set with ID=${_user.id}, Name=${_user.name}');
    notifyListeners();

    // Start listening to the specific user's updates
    log('Emitting listen_to_user for user ID=${_user.id}');
    _socket.emit('listen_to_user', _user.id);
  }

  void setUserFromModel(UserModel user) {
    log('Setting user from model: ID=${user.id}, Name=${user.name}');
    _user = user;
    notifyListeners();

    // Start listening to the specific user's updates
    log('Emitting listen_to_user for user ID=${_user.id}');
    _socket.emit('listen_to_user', _user.id);
  }

  Future<void> updateLocation(double latitude, double longitude) async {
    log('Updating location for user ${_user.id} to [lat=$latitude, long=$longitude]');
    _user.location = [latitude, longitude];
    await LocationService.updateUserLocation(_user.id, latitude, longitude);
    notifyListeners();
  }

  void logout() {
    log('Logging out user ID=${_user.id}');
    _socket.emit('stop_listening_to_user', _user.id);
    _user = UserModel(
      id: '',
      name: '',
      email: '',
      token: '',
      address: '',
      password: '',
      location: [],
      events: [],
      notifications: [],
      itemsListed: [],
      itemsLended: [],
      itemsBorrowed: [],
      itemsRequested: [],
    );
    notifyListeners();
    log('User reset after logout');
  }
}
