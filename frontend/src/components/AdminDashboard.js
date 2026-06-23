import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import axios from 'axios';
import QRCode from 'qrcode';
import {
  Container, Header, Title, LogoutButton, Card, CardTitle, Button,
  QRContainer, QRToken, QRImage, Section, RefreshButton, Table,
  TableHeader, TableCell, TableRow, TabContainer, TabButton, FormGrid,
  FormGroup, Label, Input, Select, CheckboxRow, ScheduleGrid, ScheduleDayRow
} from './AdminDashboardStyles';

const API_URL = '';
const EC_TIMEZONE = 'America/Guayaquil';
const formatEC = (date) => new Date(date).toLocaleString('es-EC', { timeZone: EC_TIMEZONE });
const formatDateEC = (date) => new Date(date).toLocaleDateString('es-EC', { timeZone: EC_TIMEZONE });
const formatTimeEC = (date) => new Date(date).toLocaleTimeString('es-EC', { timeZone: EC_TIMEZONE });

const DAYS_OF_WEEK = [
  { value: 1, label: 'Lunes' },
  { value: 2, label: 'Martes' },
  { value: 3, label: 'Miércoles' },
  { value: 4, label: 'Jueves' },
  { value: 5, label: 'Viernes' },
  { value: 6, label: 'Sábado' },
  { value: 0, label: 'Domingo' }
];

const FINE_TYPE_LABELS = {
  missing_entry: 'Falta Entrada',
  missing_exit: 'Falta Salida',
  late_entry: 'Entrada Tarde',
  early_exit: 'Salida Temprana'
};

const AdminDashboard = () => {
  const [activeTab, setActiveTab] = useState('attendance');
  const [users, setUsers] = useState([]);
  const [attendance, setAttendance] = useState([]);
  const [fines, setFines] = useState([]);
  const [schedules, setSchedules] = useState([]);
  
  // User Creation State
  const [newUser, setNewUser] = useState({ name: '', email: '', password: '', role: 'employee' });
  const [userError, setUserError] = useState('');
  const [userSuccess, setUserSuccess] = useState('');
  
  // Schedules Config State
  const [scheduleTarget, setScheduleTarget] = useState('general');
  const [daysConfig, setDaysConfig] = useState({});
  const [isCustomSchedule, setIsCustomSchedule] = useState(false);
  const [scheduleError, setScheduleError] = useState('');
  const [scheduleSuccess, setScheduleSuccess] = useState('');

  // QR State
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
    loadFines();
    loadSchedules();
  }, []);

  useEffect(() => {
    if (schedules.length > 0) {
      getScheduleForTarget(scheduleTarget, schedules);
    }
  }, [scheduleTarget, schedules]);

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

  const loadFines = async () => {
    try {
      const token = localStorage.getItem('token');
      const res = await axios.get(`${API_URL}/api/admin/fines`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      setFines(res.data);
    } catch (err) {
      console.error('Failed to load fines', err);
    }
  };

  const loadSchedules = async () => {
    try {
      const token = localStorage.getItem('token');
      const res = await axios.get(`${API_URL}/api/admin/schedules`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      setSchedules(res.data);
    } catch (err) {
      console.error('Failed to load schedules', err);
    }
  };

  const getScheduleForTarget = (target, allSchedules) => {
    const config = {};
    for (let i = 0; i < 7; i++) {
      config[i] = { is_workday: false, start_time: '', end_time: '' };
    }
    
    if (target === 'general') {
      const filtered = allSchedules.filter(s => s.user_id === null);
      for (const s of filtered) {
        config[s.day_of_week] = {
          is_workday: s.is_workday === 1,
          start_time: s.start_time || '',
          end_time: s.end_time || ''
        };
      }
      setIsCustomSchedule(false);
    } else {
      const userSpecific = allSchedules.filter(s => s.user_id === target);
      if (userSpecific.length > 0) {
        for (const s of userSpecific) {
          config[s.day_of_week] = {
            is_workday: s.is_workday === 1,
            start_time: s.start_time || '',
            end_time: s.end_time || ''
          };
        }
        setIsCustomSchedule(true);
      } else {
        const general = allSchedules.filter(s => s.user_id === null);
        for (const s of general) {
          config[s.day_of_week] = {
            is_workday: s.is_workday === 1,
            start_time: s.start_time || '',
            end_time: s.end_time || ''
          };
        }
        setIsCustomSchedule(false);
      }
    }
    setDaysConfig(config);
  };

  const handleCreateUser = async (e) => {
    e.preventDefault();
    setUserError('');
    setUserSuccess('');
    try {
      const token = localStorage.getItem('token');
      await axios.post(`${API_URL}/api/admin/users`, newUser, {
        headers: { Authorization: `Bearer ${token}` }
      });
      setUserSuccess('Usuario creado exitosamente.');
      setNewUser({ name: '', email: '', password: '', role: 'employee' });
      loadUsers();
    } catch (err) {
      setUserError(err.response?.data?.error || err.message || 'Error al crear usuario');
    }
  };

  const handleSaveSchedule = async (e) => {
    e.preventDefault();
    setScheduleError('');
    setScheduleSuccess('');
    try {
      const token = localStorage.getItem('token');
      const payload = {
        user_id: scheduleTarget === 'general' ? null : scheduleTarget,
        schedules: Object.keys(daysConfig).map(day => ({
          day_of_week: parseInt(day),
          is_workday: daysConfig[day].is_workday ? 1 : 0,
          start_time: daysConfig[day].start_time || null,
          end_time: daysConfig[day].end_time || null
        }))
      };
      await axios.post(`${API_URL}/api/admin/schedules`, payload, {
        headers: { Authorization: `Bearer ${token}` }
      });
      setScheduleSuccess('Horario guardado correctamente.');
      loadSchedules();
    } catch (err) {
      setScheduleError(err.response?.data?.error || err.message || 'Error al guardar horario');
    }
  };

  const handleResetSchedule = async () => {
    if (scheduleTarget === 'general') return;
    if (!window.confirm('¿Seguro que deseas restablecer el horario al general de la empresa?')) return;
    setScheduleError('');
    setScheduleSuccess('');
    try {
      const token = localStorage.getItem('token');
      await axios.delete(`${API_URL}/api/admin/schedules/user/${scheduleTarget}`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      setScheduleSuccess('Horario restablecido al general de la empresa.');
      loadSchedules();
    } catch (err) {
      setScheduleError(err.response?.data?.error || err.message || 'Error al restablecer horario');
    }
  };

  const handleDeleteAttendance = async (attendanceId) => {
    if (!window.confirm('¿Estás seguro de que quieres eliminar este registro de asistencia?')) return;
    try {
      const token = localStorage.getItem('token');
      await axios.delete(`${API_URL}/api/admin/attendance/${attendanceId}`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      loadAttendance();
      loadFines(); // Re-sync fines since attendance changes
    } catch (err) {
      alert('Error: ' + (err.response?.data?.error || err.message));
    }
  };

  const handleDeleteFine = async (fineId) => {
    if (!window.confirm('¿Estás seguro de que deseas perdonar/eliminar esta multa?')) return;
    try {
      const token = localStorage.getItem('token');
      await axios.delete(`${API_URL}/api/admin/fines/${fineId}`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      loadFines();
    } catch (err) {
      alert('Error: ' + (err.response?.data?.error || err.message));
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

  const checkRedDays = (records) => {
    const sorted = [...records].sort((a, b) => new Date(a.timestamp) - new Date(b.timestamp));
    const redDays = new Set();
    
    const groupedByDay = {};
    for (const r of sorted) {
      const day = formatDateEC(r.timestamp);
      if (!groupedByDay[day]) groupedByDay[day] = [];
      groupedByDay[day].push(r);
    }
    
    for (const [day, dayRecords] of Object.entries(groupedByDay)) {
      const entries = dayRecords.filter(r => r.type === 'entry');
      for (const entry of entries) {
        const nextExit = dayRecords.find(r => r.type === 'exit' && new Date(r.timestamp) > new Date(entry.timestamp));
        if (nextExit) {
          const diffHrs = (new Date(nextExit.timestamp) - new Date(entry.timestamp)) / (1000 * 60 * 60);
          if (diffHrs > 10) {
            redDays.add(day);
            break;
          }
        } else {
          const diffHrs = (new Date() - new Date(entry.timestamp)) / (1000 * 60 * 60);
          if (diffHrs > 10) {
            redDays.add(day);
            break;
          }
        }
      }
    }
    return redDays;
  };

  return (
    <Container>
      <Header>
        <Title>Panel de Administración</Title>
        <LogoutButton onClick={handleLogout}>Cerrar Sesión</LogoutButton>
      </Header>

      <TabContainer>
        <TabButton $active={activeTab === 'attendance'} onClick={() => setActiveTab('attendance')}>
          📅 Asistencias
        </TabButton>
        <TabButton $active={activeTab === 'users'} onClick={() => setActiveTab('users')}>
          👥 Usuarios
        </TabButton>
        <TabButton $active={activeTab === 'schedules'} onClick={() => setActiveTab('schedules')}>
          ⏰ Horarios
        </TabButton>
        <TabButton $active={activeTab === 'fines'} onClick={() => setActiveTab('fines')}>
          ⚠️ Multas
        </TabButton>
      </TabContainer>

      {activeTab === 'attendance' && (
        <>
          <Card>
            <CardTitle>Generar Código QR</CardTitle>
            <Button $success onClick={generateQR} disabled={generating}>
              {generating ? 'Generando...' : 'Generar Nuevo QR'}
            </Button>
            {showQR && qrToken && (
              <QRContainer>
                <div>QR Token (expira a las {qrExpiry ? formatTimeEC(qrExpiry) : ''} Ecuador/Guayaquil):</div>
                <QRToken>{qrToken}</QRToken>
                <QRImage src={qrImageData} alt="QR Code" />
              </QRContainer>
            )}
          </Card>

          <Section>
            <CardTitle>Registro de Asistencias por Colaborador</CardTitle>
            <RefreshButton onClick={loadAttendance}>Actualizar</RefreshButton>
            
            {attendance.length === 0 ? (
              <p>No hay registros de asistencia.</p>
            ) : (
              Object.entries(
                attendance.reduce((groups, record) => {
                  const key = record.user_id;
                  if (!groups[key]) groups[key] = { name: record.name, email: record.email, records: [] };
                  groups[key].records.push(record);
                  return groups;
                }, {})
              ).map(([userId, group]) => {
                const redDays = checkRedDays(group.records);
                return (
                  <div key={userId} style={{ marginBottom: 28, backgroundColor: '#ffffff', padding: '15px', borderRadius: '6px', boxShadow: '0 1px 3px rgba(0,0,0,0.1)' }}>
                    <h4 style={{ margin: '0 0 10px 0', color: '#333' }}>{group.name} ({group.email})</h4>
                    <Table>
                      <thead>
                        <tr>
                          <TableHeader>Tipo</TableHeader>
                          <TableHeader>Fecha y Hora (Ecuador/Guayaquil)</TableHeader>
                          <TableHeader>Acciones</TableHeader>
                        </tr>
                      </thead>
                      <tbody>
                        {group.records.map((a) => {
                          const isRed = redDays.has(formatDateEC(a.timestamp));
                          return (
                            <TableRow key={a.id} $isRed={isRed}>
                              <TableCell style={{ fontWeight: '600' }}>
                                {a.type === 'entry' ? 'Entrada' : 'Salida'}
                              </TableCell>
                              <TableCell>{formatEC(a.timestamp)}</TableCell>
                              <TableCell>
                                <button
                                  onClick={() => handleDeleteAttendance(a.id)}
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
                                  Eliminar
                                </button>
                              </TableCell>
                            </TableRow>
                          );
                        })}
                      </tbody>
                    </Table>
                  </div>
                );
              })
            )}
          </Section>
        </>
      )}

      {activeTab === 'users' && (
        <Section>
          <CardTitle>Crear Nuevo Usuario</CardTitle>
          {userError && <div style={{ color: '#dc3545', marginBottom: '10px', fontWeight: '500' }}>{userError}</div>}
          {userSuccess && <div style={{ color: '#28a745', marginBottom: '10px', fontWeight: '500' }}>{userSuccess}</div>}
          
          <FormGrid onSubmit={handleCreateUser}>
            <FormGroup>
              <Label>Nombre Completo:</Label>
              <Input
                type="text"
                value={newUser.name}
                onChange={e => setNewUser({ ...newUser, name: e.target.value })}
                required
                placeholder="Nombre del empleado"
              />
            </FormGroup>
            
            <FormGroup>
              <Label>Correo Electrónico:</Label>
              <Input
                type="email"
                value={newUser.email}
                onChange={e => setNewUser({ ...newUser, email: e.target.value })}
                required
                placeholder="correo@empresa.com"
              />
            </FormGroup>
            
            <FormGroup>
              <Label>Contraseña:</Label>
              <Input
                type="password"
                value={newUser.password}
                onChange={e => setNewUser({ ...newUser, password: e.target.value })}
                required
                placeholder="Mínimo 6 caracteres"
              />
            </FormGroup>
            
            <FormGroup>
              <Label>Rol:</Label>
              <Select
                value={newUser.role}
                onChange={e => setNewUser({ ...newUser, role: e.target.value })}
              >
                <option value="employee">Empleado</option>
                <option value="admin">Administrador</option>
              </Select>
            </FormGroup>
            
            <Button $success type="submit" style={{ marginBottom: 0, height: '40px' }}>
              Crear Usuario
            </Button>
          </FormGrid>

          <CardTitle>Usuarios Registrados ({users.length})</CardTitle>
          <RefreshButton onClick={loadUsers}>Actualizar Lista</RefreshButton>
          <Table>
            <thead>
              <tr>
                <TableHeader>Nombre</TableHeader>
                <TableHeader>Correo</TableHeader>
                <TableHeader>Rol</TableHeader>
                <TableHeader>Fecha de Registro</TableHeader>
              </tr>
            </thead>
            <tbody>
              {users.map((u) => (
                <tr key={u.id}>
                  <TableCell>{u.name}</TableCell>
                  <TableCell>{u.email}</TableCell>
                  <TableCell>{u.role === 'admin' ? 'Administrador' : 'Empleado'}</TableCell>
                  <TableCell>{formatDateEC(u.created_at)}</TableCell>
                </tr>
              ))}
            </tbody>
          </Table>
        </Section>
      )}

      {activeTab === 'schedules' && (
        <Section>
          <CardTitle>Configuración de Horarios de Trabajo</CardTitle>
          <p style={{ color: '#666', fontSize: '14px', marginTop: '-5px' }}>
            Puedes definir el horario general de la empresa, o personalizar el horario específico para ciertos empleados. Las horas son opcionales.
          </p>

          <FormGroup style={{ maxWidth: '400px', marginBottom: '20px' }}>
            <Label>Editar horario de:</Label>
            <Select
              value={scheduleTarget}
              onChange={e => setScheduleTarget(e.target.value)}
            >
              <option value="general">Empresa (Horario General)</option>
              {users.filter(u => u.role !== 'admin').map(u => (
                <option key={u.id} value={u.id}>{u.name} ({u.email})</option>
              ))}
            </Select>
          </FormGroup>

          {scheduleError && <div style={{ color: '#dc3545', marginBottom: '10px', fontWeight: '500' }}>{scheduleError}</div>}
          {scheduleSuccess && <div style={{ color: '#28a745', marginBottom: '10px', fontWeight: '500' }}>{scheduleSuccess}</div>}

          <form onSubmit={handleSaveSchedule}>
            <div style={{ background: '#f8f9fa', padding: '15px', borderRadius: '6px', border: '1px solid #e9ecef', marginBottom: '15px' }}>
              <h4 style={{ margin: '0 0 10px 0' }}>
                {scheduleTarget === 'general' ? 'Horario General de la Empresa' : 'Horario Personalizado'}
                {scheduleTarget !== 'general' && (
                  <span style={{ fontSize: '12px', fontWeight: 'normal', marginLeft: '10px', color: isCustomSchedule ? '#28a745' : '#666' }}>
                    ({isCustomSchedule ? 'Horario personalizado activo' : 'Heredando horario general'})
                  </span>
                )}
              </h4>
              
              <ScheduleGrid>
                {DAYS_OF_WEEK.map(day => {
                  const dayVal = day.value;
                  const config = daysConfig[dayVal] || { is_workday: false, start_time: '', end_time: '' };
                  return (
                    <ScheduleDayRow key={dayVal} $isWorkday={config.is_workday}>
                      <CheckboxRow>
                        <input
                          type="checkbox"
                          id={`day-${dayVal}`}
                          checked={config.is_workday}
                          onChange={e => {
                            setDaysConfig({
                              ...daysConfig,
                              [dayVal]: { ...config, is_workday: e.target.checked }
                            });
                          }}
                        />
                        <Label htmlFor={`day-${dayVal}`} style={{ cursor: 'pointer', margin: 0 }}>
                          {day.label}
                        </Label>
                      </CheckboxRow>

                      <div style={{ fontSize: '13px', color: config.is_workday ? '#28a745' : '#dc3545', fontWeight: '500' }}>
                        {config.is_workday ? 'Día Laboral' : 'Descanso'}
                      </div>

                      <FormGroup>
                        <Label>Hora Entrada (opcional):</Label>
                        <Input
                          type="time"
                          disabled={!config.is_workday}
                          value={config.start_time}
                          onChange={e => {
                            setDaysConfig({
                              ...daysConfig,
                              [dayVal]: { ...config, start_time: e.target.value }
                            });
                          }}
                        />
                      </FormGroup>

                      <FormGroup>
                        <Label>Hora Salida (opcional):</Label>
                        <Input
                          type="time"
                          disabled={!config.is_workday}
                          value={config.end_time}
                          onChange={e => {
                            setDaysConfig({
                              ...daysConfig,
                              [dayVal]: { ...config, end_time: e.target.value }
                            });
                          }}
                        />
                      </FormGroup>
                    </ScheduleDayRow>
                  );
                })}
              </ScheduleGrid>
            </div>

            <div style={{ display: 'flex', gap: '10px' }}>
              <Button $success type="submit" style={{ marginBottom: 0 }}>
                Guardar Horario
              </Button>
              
              {scheduleTarget !== 'general' && isCustomSchedule && (
                <Button type="button" onClick={handleResetSchedule} style={{ marginBottom: 0, color: '#dc3545', borderColor: '#dc3545' }}>
                  Restablecer a Horario General
                </Button>
              )}
            </div>
          </form>
        </Section>
      )}

      {activeTab === 'fines' && (
        <Section>
          <CardTitle>Historial de Multas por Incumplimiento</CardTitle>
          <p style={{ color: '#666', fontSize: '14px', marginTop: '-5px' }}>
            Las multas se calculan automáticamente para los días laborales pasados en base a las marcaciones de entrada y salida configuradas.
          </p>
          <RefreshButton onClick={loadFines}>Actualizar Multas</RefreshButton>

          {fines.length === 0 ? (
            <p>No se han registrado multas.</p>
          ) : (
            <Table>
              <thead>
                <tr>
                  <TableHeader>Colaborador</TableHeader>
                  <TableHeader>Fecha Afectada</TableHeader>
                  <TableHeader>Tipo de Infracción</TableHeader>
                  <TableHeader>Detalles</TableHeader>
                  <TableHeader>Acción</TableHeader>
                </tr>
              </thead>
              <tbody>
                {fines.map((f) => (
                  <tr key={f.id}>
                    <TableCell>
                      <div style={{ fontWeight: '500' }}>{f.name}</div>
                      <div style={{ fontSize: '12px', color: '#666' }}>{f.email}</div>
                    </TableCell>
                    <TableCell>{f.date}</TableCell>
                    <TableCell style={{ color: '#dc3545', fontWeight: '600' }}>
                      {FINE_TYPE_LABELS[f.type] || f.type}
                    </TableCell>
                    <TableCell>{f.details}</TableCell>
                    <TableCell>
                      <button
                        onClick={() => handleDeleteFine(f.id)}
                        style={{
                          padding: '6px 12px',
                          background: '#28a745',
                          color: '#fff',
                          border: 'none',
                          borderRadius: 4,
                          cursor: 'pointer',
                          fontSize: 13,
                          fontWeight: '500'
                        }}
                      >
                        Perdonar
                      </button>
                    </TableCell>
                  </tr>
                ))}
              </tbody>
            </Table>
          )}
        </Section>
      )}
    </Container>
  );
};

export default AdminDashboard;
