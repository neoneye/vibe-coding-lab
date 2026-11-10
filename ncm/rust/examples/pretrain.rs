//! Trains both stages natively on the bundled corpora and prints held-out
//! numbers. Usage:
//!   cargo run --release --example pretrain -- --tok-steps 3000 --gen-steps 3000 [--out file]
//!   size overrides: --d N --codes N --gen-width N --gen-blocks N --levels 1,4,8,...
//!   hyperparameters: --lr-tok X --lr-gen X --batch N --corrupt X --delta X --alpha X --fine-drop X

use ncm::data::Charset;
use ncm::session::{Config, Hparams, Session, Stage};
use std::time::Instant;

fn main() {
    let args: Vec<String> = std::env::args().collect();
    let get = |name: &str| args.iter().position(|a| a == name).map(|i| args[i + 1].clone());
    let num = |name: &str, default: f64| get(name).map_or(default, |v| v.parse().unwrap());
    let dir = concat!(env!("CARGO_MANIFEST_DIR"), "/../corpus/");
    let fr = std::fs::read_to_string(format!("{dir}frankenstein.txt")).unwrap();
    let sh = std::fs::read_to_string(format!("{dir}shakespeare.txt")).unwrap();
    let text = format!("{fr}{sh}");
    let charset = Charset::from_text(&text);

    let mut cfg = Config::default();
    cfg.d = num("--d", cfg.d as f64) as usize;
    cfg.codes = num("--codes", cfg.codes as f64) as usize;
    cfg.gen_width = num("--gen-width", cfg.gen_width as f64) as usize;
    cfg.gen_blocks = num("--gen-blocks", cfg.gen_blocks as f64) as usize;
    cfg.dec_blocks = num("--dec-blocks", cfg.dec_blocks as f64) as usize;
    if let Some(l) = get("--levels") {
        cfg.levels = l.split(',').map(|v| v.parse().unwrap()).collect();
    }
    let tok_steps = num("--tok-steps", 2000.0) as u32;
    let gen_steps = num("--gen-steps", 2000.0) as u32;
    let mut hp = Hparams::default();
    hp.lr_tok = num("--lr-tok", hp.lr_tok as f64) as ncm::F;
    hp.lr_gen = num("--lr-gen", hp.lr_gen as f64) as ncm::F;
    hp.batch = num("--batch", hp.batch as f64) as usize;
    hp.corrupt_mean = num("--corrupt", hp.corrupt_mean as f64) as ncm::F;
    hp.corrupt_delta = num("--delta", hp.corrupt_delta as f64) as ncm::F;
    hp.alpha = num("--alpha", hp.alpha as f64) as ncm::F;
    hp.fine_drop = num("--fine-drop", hp.fine_drop as f64) as ncm::F;

    // --resume file continues from a checkpoint (its shape wins over the size flags).
    let mut s = match get("--resume") {
        Some(path) => ncm::checkpoint::load(&std::fs::read(path).unwrap()).unwrap(),
        None => Session::new(cfg.clone(), charset),
    };
    if args.iter().any(|a| a == "--fresh-gen") {
        s.reset_generator();
    }
    let cfg = s.cfg.clone();
    s.set_corpus(&text).unwrap();
    s.threads = num("--threads", std::thread::available_parallelism().map_or(1, |n| n.get().min(8)) as f64) as usize;
    let np_tok = ncm::param::count(&mut s.tok);
    let np_gen = ncm::param::count(&mut s.gen);
    println!("config {:?}", cfg);
    println!("tokenizer {} params (+{} codebook), generator {} params", np_tok, cfg.codes * cfg.d * cfg.levels.len(), np_gen);
    let every = num("--every", 500.0) as u32;

    hp.total_steps = tok_steps;
    s.set_hparams(hp.clone());
    let t0 = Instant::now();
    let mut done = 0;
    while done < tok_steps {
        let t1 = Instant::now();
        let st = s.train(Stage::Tokenizer, every.min(tok_steps - done)).unwrap();
        print!("[{:.0} ms/step] ", t1.elapsed().as_secs_f64() * 1000.0 / st.steps as f64);
        done += st.steps;
        let ev = s.eval_tokenizer(4, 64).unwrap();
        println!(
            "tok {:6} {:6.1}s loss {:.3} recon {:.3} vq {:.3} train-acc {:.3} | held-out acc/cutoff {} | util {}",
            done,
            t0.elapsed().as_secs_f64(),
            st.tok.loss,
            st.tok.recon_loss,
            st.tok.vq_loss,
            st.tok.acc,
            ev.acc_per_cutoff.iter().map(|a| format!("{:.2}", a)).collect::<Vec<_>>().join(" "),
            ev.util_per_level.iter().map(|a| format!("{:.2}", a)).collect::<Vec<_>>().join(" "),
        );
    }

    hp.total_steps = gen_steps;
    s.set_hparams(hp.clone());
    let t0 = Instant::now();
    let mut done = 0;
    while done < gen_steps {
        let t1 = Instant::now();
        let st = s.train(Stage::Generator, every.min(gen_steps - done)).unwrap();
        print!("[{:.0} ms/step] ", t1.elapsed().as_secs_f64() * 1000.0 / st.steps as f64);
        done += st.steps;
        let ev = s.eval_generator(4, 64).unwrap();
        println!(
            "gen {:6} {:6.1}s train {:.3} | held-out loss/level {} | unigram {} | acc {}",
            done,
            t0.elapsed().as_secs_f64(),
            st.gen.loss,
            ev.stats.per_level_loss.iter().map(|a| format!("{:.2}", a)).collect::<Vec<_>>().join(" "),
            ev.unigram_per_level.iter().map(|a| format!("{:.2}", a)).collect::<Vec<_>>().join(" "),
            ev.stats.per_level_acc.iter().map(|a| format!("{:.2}", a)).collect::<Vec<_>>().join(" "),
        );
    }
    if gen_steps > 0 {
    }
    if s.gen_steps > 0 {
        let (k, l) = (cfg.levels.len(), cfg.l());
        for temp in [1.0, 0.8, 0.6] {
            let mut rng = ncm::rng::Rng::new(7);
            let out = s.gen.generate(&s.tok, &s.l1, 5, &mut rng, temp as ncm::F, 0, None);
            for i in 0..5 {
                let text = s.charset.decode(&out.texts[(i * k + k - 1) * l..(i * k + k) * l]);
                println!("temp {} sample {}: {:?}", temp, i, text);
            }
            if temp == 1.0 {
                for lv in 0..k {
                    println!("  level {}: {:?}", lv + 1, s.charset.decode(&out.texts[lv * l..(lv + 1) * l]));
                }
            }
        }
    }
    if let Some(path) = get("--out") {
        let bytes = ncm::checkpoint::save(&mut s);
        std::fs::write(&path, &bytes).unwrap();
        println!("wrote {} ({} bytes)", path, bytes.len());
    }
}
