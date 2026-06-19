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

const EC_TIMEZONE = 'America/Guayaquil';
const formatEC = (date) => new Date(date).toLocaleString('es-EC', { timeZone: EC_TIMEZONE });
const formatDateEC = (date) => new Date(date).toLocaleDateString('es-EC', { timeZone: EC_TIMEZONE });
const formatTimeEC = (date) => new Date(date).toLocaleTimeString('es-EC', { timeZone: EC_TIMEZONE });

const AdminDashboard = () => {
  const [users, setUsers] = useState([]);
  const [attendance, setAttendance] = useState([]);
  const [qrToken, setQrToken] = useState('');
  const [qrImageData, setQrImageData] = useState('');
  const [qrExpiry, setQrExpiry] = useState(null);
  const [generating, setGenerating] = useState(false);
  const [showQR, setShowQR] = useState(false);
  const { logout } = useAuth();
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

  const handleDelete = async (attendanceId) => {
    if (!window.confirm('Are you sure you want to delete this attendance record?')) return;
    try {
      const token = localStorage.getItem('token');
      await axios.delete(`${API_URL}/api/admin/attendance/${attendanceId}`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      loadAttendance();
    } catch (err) {
      alert('Failed to delete: ' + (err.response?.data?.error || err.message));
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
            <div>QR Token (expires at {qrExpiry ? formatTimeEC(qrExpiry) : ''} Ecuador/Guayaquil):</div>
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
                <TableCell>{formatDateEC(u.created_at)}</TableCell>
              </tr>
            ))}
          </tbody>
        </Table>
      </Section>

      <Section>
        <CardTitle>Attendance by Employee</CardTitle>
        <RefreshButton onClick={loadAttendance}>Refresh</RefreshButton>
        {Object.entries(
          attendance.reduce((groups, record) => {
            const key = record.user_id;
            if (!groups[key]) groups[key] = { name: record.name, email: record.email, records: [] };
            groups[key].records.push(record);
            return groups;
          }, {})
        ).map(([userId, group]) => (
          <div key={userId} style={{ marginBottom: 24 }}>
            <h4 style={{ margin: '12px 0 4px' }}>{group.name} ({group.email})</h4>
            <Table>
              <thead>
                <tr>
                  <TableHeader>Type</TableHeader>
                  <TableHeader>Timestamp (Ecuador/Guayaquil)</TableHeader>
                  <TableHeader>Actions</TableHeader>
                </tr>
              </thead>
              <tbody>
                {group.records.map((a) => (
                  <tr key={a.id}>
                    <TableCell>{a.type}</TableCell>
                    <TableCell>{formatEC(a.timestamp)}</TableCell>
                    <TableCell>
                      <button
                        onClick={() => handleDelete(a.id)}
                        style={{
                          padding: '4px 10px',
                          background: '#dc3545',
                          color: '#fff',
                          border: 'none',
                          borderRadius: 4,
                          cursor: 'pointer',
                          fontSize: 13
                        }}
                      >
                        Delete
                      </button>
                    </TableCell>
                  </tr>
                ))}
              </tbody>
            </Table>
          </div>
        ))}
      </Section>
    </Container>
  );
};

export default AdminDashboard;
