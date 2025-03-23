# React-Depict

React-Depict is a VS Code extension that visually represents the structure and dependencies of React components. This tool visualizes the relationships between components in your project as an interactive graph, helping developers understand the structure of complex React applications at a glance.

## Key Features

- 🎯 **React Component Dependency Visualization**: Display import relationships between components in an intuitive graph
- 🔄 **Component Type Distinction**: Visually distinguish between different types of modules like components, hooks, utilities, and constants
- 📊 **Usage Statistics Analysis**: Get quick insights into component usage counts and dependency relationships
- 🔍 **Component Search and Filtering**: Find components by name and filter nodes by type
- 🎨 **Interactive Graph**: Support for clicking nodes, dragging, zooming in/out, and other interactions
- 📱 **Detail Panel**: View detailed information, dependencies, and dependents of the selected component

## Technology Stack

- Powerful graph visualization using D3.js
- TypeScript/React project analysis
- VS Code webview-based interface

## Installation

1. Search for "React-Depict" in VS Code's Extension Marketplace
2. Click "Install"
3. Restart VS Code

## Usage

### View Complete React Dependency Tree

1. Open the command palette (`Cmd+Shift+P` or `Ctrl+Shift+P`) and run "React Depict: Show React Dependency Tree"
2. The React component dependency graph for your project will appear in a new panel

### Analyze Dependencies Centered on a Specific Component

1. Open the command palette (`Cmd+Shift+P` or `Ctrl+Shift+P`) and run "React Depict: Show Dependency Tree for Specific Component"
2. Enter the name of the component you want to analyze
3. A dependency graph centered on that component will appear in a new panel

## Graph Usage

- **Node Selection**: Click on a node to highlight dependencies related to that component
- **Node Movement**: Drag nodes to adjust the layout of the graph
- **Graph Navigation**: Use zoom buttons or mouse wheel to navigate the graph
- **Component Search**: Enter a component name in the search box to find specific nodes
- **Type Filtering**: Filter nodes by type such as components, hooks, utilities, or constants
- **View Details**: Select a node to display component details in the right panel

## Screenshots

_Add screenshots of the extension in use here._

## Extension Settings

The current version does not provide specific setting options. More customization options will be added in future versions.

## Supported Features

- TypeScript/JavaScript React component support
- Function and Class component analysis
- Identification of various module types including components, hooks, utilities, and constants
- Support for complex project structures and monorepos
- Path alias handling
- Component type inference based on directory structure

## Known Issues

- Dynamic component generation may affect analysis accuracy
- Initial analysis might take time in large projects
- Some complex import patterns or non-relative paths may not be analyzed correctly

## Release Notes

### 0.0.1 (Initial Version)
- Basic React component dependency visualization
- Interactive graph based on D3.js
- Node styling by component type
- Component search and filtering capability
- Detail panel implementation

## Multi-language Support

This README is also available in Korean: [README.ko.md](README.ko.md)

## Contributing

If you'd like to contribute to this project:

1. Fork the repository
2. Create your feature branch (`git checkout -b feature/AmazingFeature`)
3. Commit your changes (`git commit -m 'Add some AmazingFeature'`)
4. Push to the branch (`git push origin feature/AmazingFeature`)
5. Open a Pull Request

## License

Distributed under the MIT License. See `LICENSE` for more information.

## Contact

If you find a bug or want to suggest a new feature, please let us know through GitHub Issues.
