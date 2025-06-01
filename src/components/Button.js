import React from "react";
import styled from "styled-components";

const StyledButton = styled.button`
  padding: ${(props) => {
    switch (props.$size) {
      case "small":
        return "0.5rem 1rem";
      case "large":
        return "1rem 2rem";
      default:
        return "1rem 2rem";
    }
  }};
  font-size: ${(props) => {
    switch (props.$size) {
      case "small":
        return "0.875rem";
      case "large":
        return "1.25rem";
      default:
        return "1.25rem";
    }
  }};
  background-color: ${(props) => {
    switch (props.$variant) {
      case "primary":
        return props.theme.accent;
      case "secondary":
        return "transparent";
      default:
        return props.theme.accent;
    }
  }};
  color: ${(props) => {
    switch (props.$variant) {
      case "primary":
        return props.theme.background;
      case "secondary":
        return props.theme.menuText;
      default:
        return props.theme.background;
    }
  }};
  border: none;
  cursor: pointer;
  width: ${(props) => (props.$fullWidth ? "100%" : "auto")};
  font-family: ${(props) => props.theme.fontFamily};
  font-weight: bold;
  -webkit-tap-highlight-color: transparent;
  -webkit-focus-ring-color: transparent;
  user-select: none;

  &:focus {
    outline: none;
    box-shadow: none;
  }

  &:focus-visible {
    outline: none;
    box-shadow: none;
  }

  &:active {
    outline: none;
    box-shadow: none;
    transform: none;
    opacity: 0.75;
  }

  &:disabled {
    cursor: not-allowed;
    opacity: 0.25;
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
