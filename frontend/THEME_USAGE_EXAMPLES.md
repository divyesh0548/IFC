# How to Use Material UI Theme Text Colors

## Method 1: Using Material UI Components with `sx` prop (Recommended)

```jsx
import Typography from '@mui/material/Typography';
import Box from '@mui/material/Box';

// Using text.primary
<Typography sx={{ color: 'text.primary' }}>
  Primary text color (#141414)
</Typography>

// Using text.secondary
<Typography sx={{ color: 'text.secondary' }}>
  Secondary text color (#292929)
</Typography>

// In a Box component
<Box sx={{ color: 'text.primary' }}>
  <p>This text uses primary color</p>
</Box>
```

## Method 2: Using `useTheme` Hook

```jsx
import { useTheme } from '@mui/material/styles';

function MyComponent() {
  const theme = useTheme();
  
  return (
    <div style={{ color: theme.palette.text.primary }}>
      Primary text
    </div>
  );
}
```

## Method 3: Using with Tailwind (via CSS Variables)

First, update your `index.css` to map theme colors:

```css
@import "tailwindcss";

:root {
  --color-text-primary: #141414;
  --color-text-secondary: #292929;
}
```

Then use in Tailwind:
```jsx
<p className="text-[var(--color-text-primary)]">Primary text</p>
```

## Method 4: Direct Access in Inline Styles

```jsx
import { useTheme } from '@mui/material/styles';

function MyComponent() {
  const theme = useTheme();
  
  return (
    <label 
      style={{ 
        color: theme.palette.text.secondary,
        fontWeight: 600 
      }}
    >
      Label text
    </label>
  );
}
```

## Example in FormDetail Component

```jsx
import { useTheme } from '@mui/material/styles';
import Typography from '@mui/material/Typography';

function FormDetail() {
  const theme = useTheme();
  
  return (
    <div>
      {/* Method 1: Using Typography with sx */}
      <Typography sx={{ color: 'text.secondary', fontWeight: 600 }}>
        Created At
      </Typography>
      
      {/* Method 2: Using theme hook */}
      <p style={{ color: theme.palette.text.secondary }}>
        {formatDateTime(formData?.created_at)}
      </p>
      
      {/* Method 3: Using Box with sx */}
      <Box sx={{ color: 'text.primary' }}>
        Form Status
      </Box>
    </div>
  );
}
```

