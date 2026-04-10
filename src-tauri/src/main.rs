fn main() {
    if let Err(error) = producer_backend::run() {
        eprintln!("{error}");
        std::process::exit(1);
    }
}
