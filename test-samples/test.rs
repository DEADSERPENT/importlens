// Rust Test File
use std::collections::HashMap;
use std::io::{self, Write};
use std::fs::File;

// Using: HashMap, io, Write
// Unused: File

fn main() {
    let mut map = HashMap::new();
    map.insert("key", "value");

    writeln!(io::stdout(), "Map size: {}", map.len()).unwrap();
}
