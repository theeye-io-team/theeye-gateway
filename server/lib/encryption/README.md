## IMPORTANTE. Solo funciona con archivos de configuración en formato JSON


> IV     debe ser un string de 16 bytes en formato hexadecimal    

> SECRET debe ser un string de 32 bytes en formato hexadecimal    


se pueden generar de la siguiente manera

```

const iv = crypto.randomBytes(16).toString('hex')

const secret = crypto.randomBytes(32).toString('hex')

```

### Encriptar / Desencriptar el archivo de configuracion

```

THEEYE_CONFIG_ENCRYPTED_SECRET="7d571e7a5e4d9375cf5ec6360247ee018648efe1eccba5894ee6659db626b5dd" \
THEEYE_CONFIG_ENCRYPTED_ALGORITHM="aes-256-ctr" \
THEEYE_CONFIG_ENCRYPTED_IV="6c888d53cd9e5d32d4a428777e6a35e0" \
node server/lib/encryption/index.js encrypt "${PWD}/config.json" > config.json.enc

```

```

THEEYE_CONFIG_ENCRYPTED_SECRET="7d571e7a5e4d9375cf5ec6360247ee018648efe1eccba5894ee6659db626b5dd" \
THEEYE_CONFIG_ENCRYPTED_ALGORITHM="aes-256-ctr" \
THEEYE_CONFIG_ENCRYPTED_IV="6c888d53cd9e5d32d4a428777e6a35e0" \
node server/lib/encryption/index.js decrypt "${PWD}/config.json.enc"

```

### Inciar Gateway con archivo de configuracion encriptado

```

THEEYE_CONFIG_ENCRYPTED_FILENAME="${PWD}/config.json.enc" \
THEEYE_CONFIG_ENCRYPTED_SECRET="7d571e7a5e4d9375cf5ec6360247ee018648efe1eccba5894ee6659db626b5dd" \
THEEYE_CONFIG_ENCRYPTED_ALGORITHM="aes-256-ctr" \
THEEYE_CONFIG_ENCRYPTED_IV="6c888d53cd9e5d32d4a428777e6a35e0" \
THEEYE_CONFIG_ENCRYPTED="true" \
NODE_ENV=dev node server/


```
