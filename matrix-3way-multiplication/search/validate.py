import numpy as np
from tensor import *
rng=np.random.default_rng(1)
F=[rng.normal(size=(4,10)) for _ in range(4)]
T=recon(F)
ok=0
for s in range(10):
    e,_=fit(T,10,s)
    ok+= e<1e-9
print("planted rank-10 recovered",ok,"/10")
T=chain_tensor(2)
for R,sc in [(15,0.3),(15,1.0),(14,1.0),(12,1.0),(10,1.0)]:
    best=min(fit(T,R,s,iters=2000,scale=sc)[0] for s in range(100,160))
    print(R,sc,best)
