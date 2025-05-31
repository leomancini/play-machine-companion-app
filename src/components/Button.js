import React from "react";
import styled from "styled-components";

const StyledButton = styled.button`
  padding: ${(props) => {
    switch (props.$size) {
      case "small":
        return "0.5rem 1rem";
      case "large":
        return "0.75rem 1.5rem";
      default:
        return "0.75rem 1.5rem";
    }
  }};
  font-size: ${(props) => {
    switch (props.$size) {
      case "small":
        return "0.875rem";
      case "large":
        return "1.125rem";
      default:
        return "1.125rem";
    }
  }};
  background-color: ${(props) => {
    switch (props.$variant) {
      case "primary":
        return props.theme.accent;
      case "secondary":
        return props.theme.menuSelectedBackground;
      case "danger":
        return "#dc3545";
      case "clear":
        return "#dc3545";
      default:
        return props.theme.accent;
    }
  }};
  color: ${(props) => {
    switch (props.$variant) {
      case "primary":
        return props.theme.background;
      case "secondary":
        return props.theme.menuSelectedText;
      case "danger":
        return "white";
      case "clear":
        return "white";
      default:
        return props.theme.background;
    }
  }};
  border: ${(props) => {
    switch (props.$variant) {
      case "clear":
        return "none";
      default:
        return `0.0625rem solid ${props.theme.border}`;
    }
  }};
  border-radius: 0.25rem;
  cursor: pointer;
  width: ${(props) => (props.$fullWidth ? "100%" : "auto")};
  font-family: ${(props) => props.theme.fontFamily};
  text-transform: ${(props) => props.theme.textTransform};
  transition: all 0.2s ease;

  &:hover:not(:disabled) {
    opacity: 0.8;
    ${(props) => {
      switch (props.$variant) {
        case "danger":
          return "background-color: #c82333;";
        case "clear":
          return "background-color: #c82333;";
        default:
          return "";
      }
    }}
  }

  &:disabled {
    background-color: #cccccc;
    cursor: not-allowed;
    opacity: 0.6;
  }
`;

const Button = ({
  children,
  variant = "primary",
  size = "large",
  fullWidth = false,
  ...props
}) => {
  return (
    <StyledButton
      $variant={variant}
      $size={size}
      $fullWidth={fullWidth}
      {...props}
    >
      {children}
    </StyledButton>
  );
};

export default Button;
