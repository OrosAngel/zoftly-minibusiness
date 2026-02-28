"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { Store, Lock, ArrowRight, Loader2, Mail, User } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/lib/supabase";

export function LoginPage() {
    const [pin, setPin] = useState("");
    const [email, setEmail] = useState("");
    const [firstName, setFirstName] = useState("");
    const [lastName, setLastName] = useState("");
    const [isLoading, setIsLoading] = useState(false);
    const [isRegistering, setIsRegistering] = useState(false);

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();

        if (!email || !pin) {
            toast.error("Por favor completa tu correo y contraseña.");
            return;
        }

        setIsLoading(true);

        if (isRegistering) {
            if (!firstName || !lastName) {
                setIsLoading(false);
                toast.error("Por favor completa tus nombres y apellidos.");
                return;
            }

            const { data, error } = await supabase.auth.signUp({
                email,
                password: pin, // Using the 'pin' variable as the password since we repurposed it
                options: {
                    data: {
                        first_name: firstName,
                        last_name: lastName,
                    }
                }
            });

            setIsLoading(false);

            if (error) {
                toast.error("Error al registrarse", {
                    description: error.message
                });
            } else {
                toast.success("¡Registro exitoso!", {
                    description: data.user?.identities?.length === 0 ? "El correo ya está registrado." : "Bienvenido a Zoftly."
                });
            }
        } else {
            const { error } = await supabase.auth.signInWithPassword({
                email,
                password: pin,
            });

            setIsLoading(false);

            if (error) {
                toast.error("Error de autenticación", {
                    description: "Revisa tu correo electrónico o contraseña."
                });
                setPin("");
            } else {
                toast.success("¡Ingreso exitoso!");
            }
        }
    };

    return (
        <div className="min-h-screen w-full flex flex-col items-center justify-center bg-slate-50/50 relative overflow-hidden">
            {/* Background Decorations */}
            <div className="absolute top-0 left-0 w-full h-96 bg-blue-600 rounded-b-[100px] -translate-y-24 scale-110 opacity-10"></div>
            <div className="absolute top-1/4 left-1/4 w-96 h-96 bg-blue-400 rounded-full mix-blend-multiply filter blur-3xl opacity-20 animate-blob"></div>
            <div className="absolute top-1/3 right-1/4 w-96 h-96 bg-purple-400 rounded-full mix-blend-multiply filter blur-3xl opacity-20 animate-blob animation-delay-2000"></div>

            <div className="z-10 w-full max-w-md p-4">
                <div className="flex flex-col items-center mb-8 space-y-2">
                    <div className="h-16 w-16 bg-blue-600 rounded-2xl flex items-center justify-center shadow-lg shadow-blue-600/20 mb-2">
                        <Store className="h-8 w-8 text-white" />
                    </div>
                    <h1 className="text-3xl font-bold tracking-tight text-slate-900">Zoftly B2B</h1>
                    <p className="text-slate-500 font-medium text-center">Software de Gestión para Bodegas</p>
                </div>

                <Card className="shadow-xl border-slate-100 bg-white/80 backdrop-blur-xl">
                    <CardHeader className="space-y-1 pb-6">
                        <CardTitle className="text-2xl font-bold text-center">
                            {isRegistering ? "Crear cuenta" : "Ingreso al Sistema"}
                        </CardTitle>
                        <CardDescription className="text-center text-slate-500">
                            {isRegistering ? "Ingresa tus datos para registrarte." : "Ingresa tus credenciales para acceder al panel."}
                        </CardDescription>
                    </CardHeader>
                    <form onSubmit={handleSubmit}>
                        <CardContent className="space-y-4">
                            {isRegistering && (
                                <>
                                    <div className="space-y-2">
                                        <Label htmlFor="firstName" className="text-slate-700 font-semibold">Nombres</Label>
                                        <div className="relative">
                                            <User className="absolute left-3 top-1/2 -translate-y-1/2 h-5 w-5 text-slate-400" />
                                            <Input
                                                id="firstName"
                                                type="text"
                                                placeholder="Ej. Juan Carlos"
                                                className="pl-10 h-12 text-md shadow-sm"
                                                value={firstName}
                                                onChange={(e) => setFirstName(e.target.value)}
                                            />
                                        </div>
                                    </div>
                                    <div className="space-y-2">
                                        <Label htmlFor="lastName" className="text-slate-700 font-semibold">Apellidos</Label>
                                        <div className="relative">
                                            <User className="absolute left-3 top-1/2 -translate-y-1/2 h-5 w-5 text-slate-400" />
                                            <Input
                                                id="lastName"
                                                type="text"
                                                placeholder="Ej. Pérez Gómez"
                                                className="pl-10 h-12 text-md shadow-sm"
                                                value={lastName}
                                                onChange={(e) => setLastName(e.target.value)}
                                            />
                                        </div>
                                    </div>
                                </>
                            )}
                            <div className="space-y-2">
                                <Label htmlFor="email" className="text-slate-700 font-semibold">Correo Electrónico</Label>
                                <div className="relative">
                                    <Mail className="absolute left-3 top-1/2 -translate-y-1/2 h-5 w-5 text-slate-400" />
                                    <Input
                                        id="email"
                                        type="email"
                                        placeholder="usuario@ejemplo.com"
                                        className="pl-10 h-12 text-md shadow-sm"
                                        value={email}
                                        onChange={(e) => setEmail(e.target.value)}
                                        autoComplete="email"
                                        autoFocus
                                    />
                                </div>
                            </div>

                            <div className="space-y-2">
                                <Label htmlFor="pin" className="text-slate-700 font-semibold">Contraseña</Label>
                                <div className="relative">
                                    <Lock className="absolute left-3 top-1/2 -translate-y-1/2 h-5 w-5 text-slate-400" />
                                    <Input
                                        id="pin"
                                        type="password"
                                        placeholder="••••••••"
                                        className="pl-10 h-12 text-md shadow-sm"
                                        value={pin}
                                        onChange={(e) => setPin(e.target.value)}
                                    />
                                </div>
                            </div>
                        </CardContent>
                        <CardFooter className="flex flex-col space-y-4">
                            <Button
                                type="submit"
                                className="w-full h-12 text-base font-semibold bg-blue-600 hover:bg-blue-700 shadow-md shadow-blue-600/20 transition-all duration-200"
                                disabled={isLoading}
                            >
                                {isLoading ? (
                                    <>
                                        <Loader2 className="mr-2 h-5 w-5 animate-spin" />
                                        Verificando...
                                    </>
                                ) : (
                                    <>
                                        {isRegistering ? "Registrarse" : "Acceder"} <ArrowRight className="ml-2 h-5 w-5" />
                                    </>
                                )}
                            </Button>

                            <Button
                                type="button"
                                variant="ghost"
                                className="w-full text-slate-500"
                                onClick={() => setIsRegistering(!isRegistering)}
                            >
                                {isRegistering ? "¿Ya tienes una cuenta? Iniciar Sesión" : "¿No tienes una cuenta? Regístrate aquí"}
                            </Button>
                        </CardFooter>
                    </form>
                </Card>

                <p className="text-center text-sm text-slate-500 mt-8">
                    &copy; {new Date().getFullYear()} Zoftly. Todos los derechos reservados.
                </p>
            </div>
        </div>
    );
}
