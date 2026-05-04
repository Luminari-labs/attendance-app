import React from 'react';
import { Link } from 'react-router-dom';
import { Container, Title, Subtitle, ButtonGroup, Button } from './styles';

export default function Welcome() {
  return (
    <Container>
      <Title>Sistema de Asistencia</Title>
      <Subtitle>Control de asistencia con códigos QR y geofencing</Subtitle>
      <ButtonGroup>
        <Button as={Link} to="/login" primary>
          Iniciar Sesión
        </Button>
        <Button as={Link} to="/register">
          Registrarse
        </Button>
      </ButtonGroup>
    </Container>
  );
}
