import styled from 'styled-components';

export const Container = styled.div`
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  min-height: 100vh;
  padding: 20px;
  background: linear-gradient(135deg, #007bff 0%, #0056b3 100%);
  color: white;
`;

export const Title = styled.h1`
  font-size: 2.5rem;
  margin-bottom: 10px;
  text-align: center;
`;

export const Subtitle = styled.p`
  font-size: 1.2rem;
  margin-bottom: 40px;
  opacity: 0.9;
  text-align: center;
`;

export const ButtonGroup = styled.div`
  display: flex;
  gap: 20px;
`;

export const Button = styled.button`
  padding: 12px 30px;
  font-size: 1rem;
  border: 2px solid white;
  border-radius: 5px;
  background: ${({ primary }) => (primary ? 'white' : 'transparent')};
  color: ${({ primary }) => (primary ? '#007bff' : 'white')};
  cursor: pointer;
  text-decoration: none;
  transition: all 0.3s ease;

  &:hover {
    background: ${({ primary }) => (primary ? '#f8f9fa' : 'rgba(255,255,255,0.1)')};
  }
`;
