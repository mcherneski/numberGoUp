# Number Go Up

This is an implementation of the Pandora ERC-404 Contracts which changes some functionality for the sake of NGU mechanics. Notable changes include: 

1. Removed the storage bank for ERC-721s, they just get burnt now if they aren't tranferred. 
2. NFT transfers are FIFO rather than LIFO now. 
3. Encoding prefix has been removed for a more simple display number. 
