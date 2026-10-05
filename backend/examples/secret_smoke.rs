use studio_backend::{domain::id, secrets::Secrets};
fn main() {
    let reference = id();
    let mut store = Secrets::default();
    match store.set(
        &reference,
        "STUDIO-DISPOSABLE-TEST-NOT-A-REAL-KEY".into(),
        false,
    ) {
        Ok(()) => {
            let configured = store.configured(&reference);
            let deleted = store.delete(&reference).is_ok();
            println!("OS secret store: configured={configured}, deleted={deleted}, plaintext written=false");
            assert!(configured && deleted);
        }
        Err(e) => {
            println!(
                "OS secret store unavailable: {}; session-only remains available",
                e.code
            );
            std::process::exit(2);
        }
    }
}
