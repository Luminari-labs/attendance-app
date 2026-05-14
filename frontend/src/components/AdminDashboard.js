import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import axios from 'axios';
import QRCode from 'qrcode';
import {
  Container, Header, Title, LogoutButton, Card, CardTitle,
  Button, QRContainer, QRToken, QRImage, Section, RefreshButton,
  Table, TableHeader, TableCell
} from './AdminDashboardStyles';

const API_URL = '';

const AdminDashboard = () => {
  const [users, setUsers] = useState([]);
  const [attendance, setAttendance] = useState([]);
  const [qrToken, setQrToken] = useState('');
  const [qrImageData, setQrImageData] = useState('');
  const [qrExpiry, setQrExpiry] = useState(null);
  const [generating, setGenerating] = useState(false);
  const [showQR, setShowQR] = useState(false);
  const { user, logout } = useAuth();
  const navigate = useNavigate();

  useEffect(() => {
    loadUsers();
    loadAttendance();
  }, []);

  const loadUsers = async () => {
    try {
      const token = localStorage.getItem('token');
      const res = await axios.get(`${API_URL}/api/admin/users`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      setUsers(res.data);
    } catch (err) {
      console.error('Failed to load users', err);
    }
  };

  const loadAttendance = async () => {
    try {
      const token = localStorage.getItem('token');
      const res = await axios.get(`${API_URL}/api/admin/attendance`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      setAttendance(res.data);
    } catch (err) {
      console.error('Failed to load attendance', err);
    }
  };

  const generateQR = async () => {
    setGenerating(true);
    try {
      const token = localStorage.getItem('token');
      const res = await axios.get(`${API_URL}/api/qr/current`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      const nextToken = res.data.token;
      const qrDataUrl = await QRCode.toDataURL(nextToken, { width: 220, margin: 1 });
      setQrToken(nextToken);
      setQrImageData(qrDataUrl);
      setQrExpiry(new Date(res.data.expires_at));
      setShowQR(true);
    } catch (err) {
      alert('Failed to generate QR: ' + (err.response?.data?.error || err.message));
    } finally {
      setGenerating(false);
    }
  };

  const handleLogout = () => {
    logout();
    navigate('/login');
  };

  return (
    <Container>
      <Header>
        <Title>Admin Dashboard</Title>
        <LogoutButton onClick={handleLogout}>Logout</LogoutButton>
      </Header>

      <Card>
        <CardTitle>Generate QR Code</CardTitle>
        <Button $success onClick={generateQR} disabled={generating}>
          {generating ? 'Generating...' : 'Generate New QR'}
        </Button>
        {showQR && qrToken && (
          <QRContainer>
            <div>QR Token (expires at {qrExpiry?.toLocaleTimeString()}):</div>
            <QRToken>{qrToken}</QRToken>
            <QRImage src={qrImageData} alt="QR Code" />
          </QRContainer>
        )}
      </Card>

      <Section>
        <CardTitle>Users ({users.length})</CardTitle>
        <RefreshButton onClick={loadUsers}>Refresh</RefreshButton>
        <Table>
          <thead>
            <tr>
              <TableHeader>Name</TableHeader>
              <TableHeader>Email</TableHeader>
              <TableHeader>Role</TableHeader>
              <TableHeader>Created</TableHeader>
            </tr>
          </thead>
          <tbody>
            {users.map((u) => (
              <tr key={u.id}>
                <TableCell>{u.name}</TableCell>
                <TableCell>{u.email}</TableCell>
                <TableCell>{u.role}</TableCell>
                <TableCell>{new Date(u.created_at).toLocaleDateString()}</TableCell>
              </tr>
            ))}
          </tbody>
        </Table>
      </Section>

      <Section>
        <CardTitle>Recent Attendance</CardTitle>
        <RefreshButton onClick={loadAttendance}>Refresh</RefreshButton>
        <Table>
          <thead>
            <tr>
              <TableHeader>Employee</TableHeader>
              <TableHeader>Type</TableHeader>
              <TableHeader>Timestamp</TableHeader>
            </tr>
          </thead>
          <tbody>
            {attendance.slice(0, 50).map((a) => (
              <tr key={a.id}>
                <TableCell>{a.name} ({a.email})</TableCell>
                <TableCell>{a.type}</TableCell>
                <TableCell>{new Date(a.timestamp).toLocaleString()}</TableCell>
              </tr>
            ))}
          </tbody>
        </Table>
      </Section>
    </Container>
  );
};

export default AdminDashboard;
